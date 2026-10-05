// Bandeja de salida (outbox) para marcar OFFLINE.
//
// Cuando no hay internet, en vez de fallar guardamos el ESTADO FINAL de cada acción en el
// teléfono y lo reenviamos solo al reconectar. Claves del diseño (🔒 no romper el sistema de premios):
//   · registro_objetivo tiene UNIQUE(id_objetivo, fecha) y se escribe por upsert → guardamos el
//     estado final por (objetivo, fecha), no cada toque. Reenviar = un upsert idempotente.
//   · Las recompensas (XP/monedas) son idempotentes por `clave` en el servidor → reenviar no duplica
//     ni resta de más. El XP se acredita al sincronizar (lo otorga el servidor), no offline.
//   · El % se calcula siempre desde registro_objetivo → al reconectar, el refetch trae la verdad.
//
// Cobertura: marcar objetivos (sí/no y numéricos), completar tareas, omitir y metas semanales.
// NO cubre crear/editar objetivos o tareas (eso necesita internet).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Prioridad, recompensaSegura, revocacionSegura } from './recompensas';
import {
  marcarObjetivoCompletado,
  omitirObjetivo,
  registrarValorNumerico,
  sumarValorHoy,
  upsertRegistro,
} from './registros';
import { completarTarea } from './tareas';

const KEY = 'DRAKOSTONE_PENDIENTES_V1';

/** Columnas de registro_objetivo que sabemos setear offline. */
type ParcheRegistro = {
  completado?: boolean;
  valor?: number;
  omitido?: boolean;
  razon_omision?: string | null;
};

type EntradaRegistro = { kind: 'registro'; id_objetivo: string; fecha: string; parche: ParcheRegistro };
type EntradaSemanalDelta = { kind: 'semanal-delta'; id_objetivo: string; fecha: string; delta: number };
type EntradaTarea = { kind: 'tarea'; id_tarea: string; completada: boolean; prioridad: Prioridad };
type Entrada = EntradaRegistro | EntradaSemanalDelta | EntradaTarea;

type Cola = Record<string, Entrada>;

// ─── Detección de "no hay internet" ──────────────────────────────────────────
/** ¿El error es por falta de conexión (y no un error real de datos)? */
export function esErrorDeRed(e: unknown): boolean {
  if (e instanceof TypeError) return true; // fetch caído en RN suele ser TypeError
  const msg = (e as { message?: string })?.message?.toLowerCase() ?? '';
  return /network request failed|failed to fetch|network error|fetch failed|timeout|timed out|no internet|offline/.test(
    msg,
  );
}

// ─── Persistencia de la cola ─────────────────────────────────────────────────
async function leerCola(): Promise<Cola> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Cola) : {};
  } catch {
    return {};
  }
}

async function guardarCola(cola: Cola): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cola));
  } catch {
    /* sin espacio o storage no disponible: se pierde el pendiente, no rompemos la app */
  }
}

/** Cantidad de cambios sin sincronizar (para el aviso en pantalla). */
export async function contarPendientes(): Promise<number> {
  return Object.keys(await leerCola()).length;
}

// ─── Encolar (merge de estado final) ─────────────────────────────────────────
async function encolarRegistro(id_objetivo: string, fecha: string, parche: ParcheRegistro): Promise<void> {
  const cola = await leerCola();
  const clave = `r:${id_objetivo}:${fecha}`;
  const prev = cola[clave];
  const parcheprevio = prev?.kind === 'registro' ? prev.parche : {};
  cola[clave] = { kind: 'registro', id_objetivo, fecha, parche: { ...parcheprevio, ...parche } };
  await guardarCola(cola);
}

async function encolarSemanalDelta(id_objetivo: string, fecha: string, delta: number): Promise<void> {
  const cola = await leerCola();
  const clave = `s:${id_objetivo}:${fecha}`;
  const prev = cola[clave];
  const acumulado = prev?.kind === 'semanal-delta' ? prev.delta : 0;
  cola[clave] = { kind: 'semanal-delta', id_objetivo, fecha, delta: acumulado + delta };
  await guardarCola(cola);
}

async function encolarTarea(id_tarea: string, completada: boolean, prioridad: Prioridad): Promise<void> {
  const cola = await leerCola();
  cola[`t:${id_tarea}`] = { kind: 'tarea', id_tarea, completada, prioridad };
  await guardarCola(cola);
}

// ─── Reenviar una entrada al servidor ────────────────────────────────────────
async function enviarEntrada(e: Entrada): Promise<void> {
  if (e.kind === 'tarea') {
    // completarTarea ya hace: update de estado final + recompensa idempotente.
    await completarTarea(e.id_tarea, e.completada, e.prioridad);
    return;
  }
  if (e.kind === 'semanal-delta') {
    await sumarValorHoy(e.id_objetivo, e.fecha, e.delta);
    return;
  }
  // registro: upsert del estado final + reconciliar la recompensa según ese estado.
  await upsertRegistro({ id_objetivo: e.id_objetivo, fecha: e.fecha, ...e.parche });
  const clave = `obj:${e.id_objetivo}:${e.fecha}`;
  if (e.parche.completado === true) await recompensaSegura('objetivo', clave);
  else if (e.parche.completado === false) await revocacionSegura(clave);
  // omitir puro (completado indefinido) no toca XP.
}

/**
 * Reenvía todo lo pendiente. Si falla por RED, corta y deja el resto para el próximo intento.
 * Si una entrada falla por un error REAL (no de red), la descarta para no trabar la cola.
 * Devuelve cuántas quedaron sin enviar.
 */
export async function sincronizarPendientes(): Promise<number> {
  const cola = await leerCola();
  const claves = Object.keys(cola);
  if (claves.length === 0) return 0;

  for (const clave of claves) {
    try {
      await enviarEntrada(cola[clave]);
      delete cola[clave]; // enviada ✓
    } catch (e) {
      if (esErrorDeRed(e)) break; // seguimos sin internet → reintentar más tarde
      delete cola[clave]; // error real/permanente → la sacamos para no trabar el resto
      console.warn('Pendiente descartado por error no recuperable:', e);
    }
  }
  await guardarCola(cola);
  return Object.keys(cola).length;
}

// ─── Wrappers: intentar online; si no hay red, encolar ───────────────────────
// Devuelven 'ok' si se guardó en el servidor, o 'encolado' si quedó pendiente (sin internet).
export type Resultado = 'ok' | 'encolado';

/** Intenta online; si falla por red, encola y devuelve 'encolado'. Si es error real, relanza. */
async function conCola(online: () => Promise<unknown>, encolar: () => Promise<void>): Promise<Resultado> {
  try {
    await online();
    void sincronizarPendientes(); // de paso, empujar lo que hubiera quedado
    return 'ok';
  } catch (e) {
    if (!esErrorDeRed(e)) throw e;
    await encolar();
    return 'encolado';
  }
}

export function guardarMarcar(id_objetivo: string, fecha: string, completado: boolean): Promise<Resultado> {
  return conCola(
    () => marcarObjetivoCompletado(id_objetivo, fecha, completado),
    () => encolarRegistro(id_objetivo, fecha, { completado }),
  );
}

export function guardarNumerico(
  id_objetivo: string,
  fecha: string,
  valor: number,
  meta: number | null,
): Promise<Resultado> {
  const v = Math.max(0, valor);
  const completado = meta != null && meta > 0 && v >= meta;
  return conCola(
    () => registrarValorNumerico(id_objetivo, fecha, v, meta),
    () => encolarRegistro(id_objetivo, fecha, { valor: v, completado }),
  );
}

export function guardarOmitir(
  id_objetivo: string,
  fecha: string,
  omitido: boolean,
  razon?: string | null,
): Promise<Resultado> {
  return conCola(
    () => omitirObjetivo(id_objetivo, fecha, omitido, razon),
    () => encolarRegistro(id_objetivo, fecha, { omitido, razon_omision: omitido ? razon?.trim() || null : null }),
  );
}

export function guardarSemanalDelta(id_objetivo: string, fecha: string, delta: number): Promise<Resultado> {
  return conCola(
    () => sumarValorHoy(id_objetivo, fecha, delta),
    () => encolarSemanalDelta(id_objetivo, fecha, delta),
  );
}

export function guardarTarea(id_tarea: string, completada: boolean, prioridad: Prioridad): Promise<Resultado> {
  return conCola(
    () => completarTarea(id_tarea, completada, prioridad),
    () => encolarTarea(id_tarea, completada, prioridad),
  );
}
