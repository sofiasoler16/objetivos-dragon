import {
  borrarEventoDragon,
  calendarioDestino,
  crearEventoDragon,
  type EventoCalendario,
  leerEventos,
  pedirPermisoCalendario,
  permisoCalendario,
} from '../calendario';
import { supabase } from '../supabase';
import { hoyISO, inicioSemanaISO, isoADate, dateAISO, sumarDiasISO } from '@/logic/fecha';
import { diaSemanaISO } from '@/logic/fecha';
import { primeraFechaOcurrencia } from '@/logic/agenda';
import { listarObjetivosConDias } from './objetivos';
import { listarTareas } from './tareas';

export type { EventoCalendario } from '../calendario';

const COLOR_DRAGON = '#7C5CFF';

/** Un ítem en la agenda: puede ser un evento externo o un objetivo/tarea nuestro con horario. */
export type ItemAgenda = {
  id: string;
  titulo: string;
  inicio: string; // ISO
  fin: string; // ISO
  todoElDia: boolean;
  ubicacion: string | null;
  color: string | null;
  /** true = objetivo/tarea de la app (con horario); false = evento externo del calendario. */
  esApp: boolean;
};

export type DiaAgenda = {
  fechaISO: string;
  esHoy: boolean;
  items: ItemAgenda[];
};

export type MotivoAgenda = 'sin-permiso' | 'error';
export type ResultadoAgenda = { ok: boolean; motivo?: MotivoAgenda; lunesISO: string; dias: DiaAgenda[] };

/** Día local ISO al que "pertenece" un evento (los de todo el día no se corren por TZ). */
function diaDelEvento(e: EventoCalendario): string {
  return e.todoElDia ? e.inicio.slice(0, 10) : dateAISO(new Date(e.inicio));
}

function externoAItem(e: EventoCalendario): ItemAgenda {
  return {
    id: e.id,
    titulo: e.titulo,
    inicio: e.inicio,
    fin: e.fin,
    todoElDia: e.todoElDia,
    ubicacion: e.ubicacion,
    color: e.color,
    esApp: false,
  };
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null);

/**
 * Objetivos/tareas NUESTROS con horario que ocurren en [desdeISO, hastaExclusivoISO).
 * Expande las ocurrencias de los recurrentes día por día. Best-effort.
 */
async function itemsAppEnRango(desdeISO: string, hastaExclusivoISO: string): Promise<ItemAgenda[]> {
  const items: ItemAgenda[] = [];

  // Objetivos con horario (DAILY / SPECIFIC_DAYS). WEEKLY_COUNT no tiene hora → no es evento.
  const objetivos = await listarObjetivosConDias({ soloActivos: true }).catch(() => []);
  for (const o of objetivos) {
    const hi = hhmm(o.hora_inicio);
    const hf = hhmm(o.hora_fin);
    if (!hi || !hf) continue;
    const inicioBound = o.fecha_inicio ? o.fecha_inicio.slice(0, 10) : desdeISO;
    const finBound = o.fecha_fin ? o.fecha_fin.slice(0, 10) : null;

    for (let f = desdeISO; f < hastaExclusivoISO; f = sumarDiasISO(f, 1)) {
      if (f < inicioBound) continue;
      if (finBound && f > finBound) continue;
      const w = diaSemanaISO(f);
      const cae = o.frecuencia_tipo === 'DAILY' || (o.frecuencia_tipo === 'SPECIFIC_DAYS' && o.dias.includes(w));
      if (!cae) continue;
      items.push({
        id: `obj:${o.id_objetivo}:${f}`,
        titulo: o.nombre,
        inicio: `${f}T${hi}:00`,
        fin: `${f}T${hf}:00`,
        todoElDia: false,
        ubicacion: null,
        color: COLOR_DRAGON,
        esApp: true,
      });
    }
  }

  // Tareas con horario (bloque en su fecha límite).
  const tareas = await listarTareas({ completadas: false }).catch(() => []);
  for (const t of tareas) {
    const hi = hhmm(t.hora_inicio);
    const hf = hhmm(t.hora_fin);
    if (!hi || !hf || !t.fecha_limite) continue;
    const f = t.fecha_limite.slice(0, 10);
    if (f < desdeISO || f >= hastaExclusivoISO) continue;
    items.push({
      id: `tar:${t.id_tarea}`,
      titulo: t.titulo,
      inicio: `${f}T${hi}:00`,
      fin: `${f}T${hf}:00`,
      todoElDia: false,
      ubicacion: null,
      color: COLOR_DRAGON,
      esApp: true,
    });
  }

  return items;
}

/**
 * Ítems de una SEMANA (lunes→domingo), mezclando eventos externos + objetivos/tareas nuestros
 * con horario, agrupados por día. Best-effort: nunca lanza.
 *  · lunesISO: lunes de la semana a mostrar (default = semana actual). Permite navegar semanas.
 *  · interactivo=true → dispara el permiso si falta.
 */
export async function eventosDeLaSemana(
  interactivo = false,
  lunesISO?: string,
): Promise<ResultadoAgenda> {
  const lunes = lunesISO ?? inicioSemanaISO(hoyISO());
  try {
    const permiso = interactivo ? await pedirPermisoCalendario() : await permisoCalendario();
    const hoy = hoyISO();
    const finExclusivo = sumarDiasISO(lunes, 7);

    // Ítems propios (de la base) — no dependen del permiso de calendario.
    const propios = await itemsAppEnRango(lunes, finExclusivo);

    // Eventos externos — solo si hay permiso (y excluyendo nuestra capa Dragón).
    let externos: ItemAgenda[] = [];
    if (permiso) {
      const eventos = await leerEventos(isoADate(lunes)!, isoADate(finExclusivo)!);
      externos = eventos.map(externoAItem);
    }

    const todos = [...externos, ...propios];
    const porDia = new Map<string, ItemAgenda[]>();
    for (const it of todos) {
      const dia = it.todoElDia ? it.inicio.slice(0, 10) : dateAISO(new Date(it.inicio));
      const lista = porDia.get(dia);
      if (lista) lista.push(it);
      else porDia.set(dia, [it]);
    }

    const dias: DiaAgenda[] = [];
    for (let i = 0; i < 7; i++) {
      const fechaISO = sumarDiasISO(lunes, i);
      const itemsDia = (porDia.get(fechaISO) ?? []).sort((a, b) => a.inicio.localeCompare(b.inicio));
      dias.push({ fechaISO, esHoy: fechaISO === hoy, items: itemsDia });
    }
    // Sin permiso igual mostramos los propios; el "conectar" aparece si además no hay externos.
    return { ok: permiso || propios.length > 0, motivo: permiso ? undefined : 'sin-permiso', lunesISO: lunes, dias };
  } catch {
    return { ok: false, motivo: 'error', lunesISO: lunes, dias: [] };
  }
}

// ── Contexto para la IA: bloques ocupados ───────────────────────────────────

/** Un compromiso concreto (fecha + rango) para que la IA no superponga. */
export type Compromiso = { titulo: string; fecha: string; desde: string; hasta: string };

/**
 * Bloques ocupados en los próximos `dias` (default 14) desde hoy: eventos externos con hora +
 * objetivos/tareas nuestros con horario. Best-effort: si algo falla, devuelve lo que pudo.
 */
export async function compromisosDeContexto(dias = 14): Promise<Compromiso[]> {
  const hoy = hoyISO();
  const finExclusivo = sumarDiasISO(hoy, dias);
  const salida: Compromiso[] = [];

  try {
    if (await permisoCalendario()) {
      const eventos = await leerEventos(isoADate(hoy)!, isoADate(finExclusivo)!);
      for (const e of eventos) {
        if (e.todoElDia) continue; // los de todo el día no bloquean franjas horarias
        const d = new Date(e.inicio);
        const df = new Date(e.fin);
        salida.push({
          titulo: e.titulo,
          fecha: dateAISO(d),
          desde: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          hasta: `${String(df.getHours()).padStart(2, '0')}:${String(df.getMinutes()).padStart(2, '0')}`,
        });
      }
    }
  } catch {
    // ignoramos: seguimos con los propios
  }

  try {
    const propios = await itemsAppEnRango(hoy, finExclusivo);
    for (const it of propios) {
      salida.push({
        titulo: it.titulo,
        fecha: it.inicio.slice(0, 10),
        desde: it.inicio.slice(11, 16),
        hasta: it.fin.slice(11, 16),
      });
    }
  } catch {
    // ignoramos
  }

  return salida.sort((a, b) => (a.fecha + a.desde).localeCompare(b.fecha + b.desde));
}

// ── Espejo al calendario "Objetivos Dragón" ─────────────────────────────────

export type EspejoEvento = {
  titulo: string;
  fechaISO: string; // primera fecha del bloque (YYYY-MM-DD)
  horaInicio: string; // HH:MM
  horaFin: string; // HH:MM
  diasRecurrentes?: number[]; // ISO 1..7 (vacío = evento único)
  hastaISO?: string | null;
};

/**
 * Crea el evento espejo en la capa "Objetivos Dragón" y devuelve su id (o null).
 * Requiere permiso de calendario; si no hay, no espeja (el objetivo igual vive en la base).
 */
export async function espejarEnCalendario(ev: EspejoEvento): Promise<string | null> {
  try {
    if (!(await permisoCalendario())) return null;
    const { data } = await supabase.auth.getUser();
    const capa = await calendarioDestino(data.user?.email ?? undefined);
    if (!capa) return null;
    const inicio = new Date(`${ev.fechaISO}T${ev.horaInicio}:00`);
    const fin = new Date(`${ev.fechaISO}T${ev.horaFin}:00`);
    if (!(fin.getTime() > inicio.getTime())) return null;
    return await crearEventoDragon(capa.id, {
      titulo: ev.titulo,
      inicio,
      fin,
      diasRecurrentes: ev.diasRecurrentes,
      hastaISO: ev.hastaISO,
    });
  } catch {
    return null;
  }
}

/** Borra el evento espejo (best-effort). */
export async function borrarEspejo(idEvento: string | null | undefined): Promise<void> {
  if (idEvento) await borrarEventoDragon(idEvento);
}

/** ¿La app ya tiene permiso de calendario? (para avisos en la UI). */
export { permisoCalendario, pedirPermisoCalendario };
