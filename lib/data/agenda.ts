import {
  borrarEventoDragon,
  borrarEventosDragonPorTitulo,
  borrarOcurrenciaDragon,
  calendarioDestino,
  conectarTelefono,
  crearEventoDragon,
  desconectarTelefono,
  type EstadoEvento,
  estadoEventoDragon,
  type EventoCalendario,
  instanciasDragonPorTitulo,
  leerEventos,
  pedirPermisoCalendario,
  permisoCalendario,
  telefonoConectado,
} from '../calendario';
import {
  actualizarOcurrenciaGoogle,
  borrarEventoGoogle,
  borrarEventosGooglePorTitulo,
  borrarOcurrenciaGoogle,
  crearEventoGoogle,
  estadoEventoGoogle,
  googleConectado,
  instanciasGooglePorTitulo,
  leerEventosGoogle,
} from '../google-calendar';
import { supabase } from '../supabase';
import { hoyISO, inicioSemanaISO, isoADate, dateAISO, sumarDiasISO } from '@/logic/fecha';
import { diaSemanaISO } from '@/logic/fecha';
import { primeraFechaOcurrencia } from '@/logic/agenda';
import { hexDeColor } from '@/logic/coloresCalendario';
import { actualizarObjetivo, type DiaHorario, listarObjetivosConDias, obtenerObjetivo, type ObjetivoConDias, setDiasObjetivo } from './objetivos';
import { omitirObjetivo, setHorarioDia } from './registros';
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
  /** true = objetivo/tarea de la app; false = evento externo del calendario. */
  esApp: boolean;
  /** true = es una TAREA (vencimiento), no un objetivo-evento. */
  esTarea?: boolean;
  /** Si es un objetivo de la app, a qué objetivo apunta (para abrir su info). */
  refObjetivoId?: string;
  /** Si es una tarea, a qué tarea apunta (para abrir su info). */
  refTareaId?: string;
};

export type DiaAgenda = {
  fechaISO: string;
  esHoy: boolean;
  items: ItemAgenda[];
};

export type MotivoAgenda = 'sin-permiso' | 'error';
export type ResultadoAgenda = { ok: boolean; motivo?: MotivoAgenda; lunesISO: string; dias: DiaAgenda[] };

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

/**
 * Eventos EXTERNOS (no de la app) del rango, unificando las dos fuentes SIN duplicar:
 *  - Si Google Calendar está conectado por su API → sus eventos salen de Google (todos los
 *    calendarios) y del teléfono leemos SOLO los calendarios que NO son de Google.
 *  - Si Google no está conectado (o su lectura falla) → todo del teléfono, como antes.
 * `usoGoogle` indica si efectivamente se leyó de Google (para saber si hay fuente aunque no haya
 * permiso de calendario del teléfono). Best-effort: nunca lanza.
 */
/**
 * Quita eventos DUPLICADOS por contenido: misma actividad (título) + mismo instante de inicio y fin.
 * 🔒 Red de seguridad contra el "evento duplicado/triplicado": en Android el calendario del teléfono
 * YA sincroniza Google, así que el mismo evento puede llegar por la API de Google Y por el calendario
 * del teléfono (o por varios calendarios). El filtro por `source.type` no siempre alcanza (varía por
 * teléfono/cuenta), así que además deduplicamos acá por (título + inicio + fin), normalizando el
 * instante a epoch para que un "10:00-03:00" y su copia sincronizada cuenten como el MISMO.
 */
function dedupEventos(eventos: EventoCalendario[]): EventoCalendario[] {
  const vistos = new Set<string>();
  const out: EventoCalendario[] = [];
  for (const e of eventos) {
    const ti = new Date(e.inicio).getTime();
    const tf = new Date(e.fin).getTime();
    const clave = `${(e.titulo ?? '').trim().toLowerCase()}|${Number.isNaN(ti) ? e.inicio : ti}|${Number.isNaN(tf) ? e.fin : tf}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(e);
  }
  return out;
}

async function leerExternos(
  desde: Date,
  hasta: Date,
  telefonoActivo: boolean,
): Promise<{ eventos: EventoCalendario[]; usoGoogle: boolean }> {
  let google: EventoCalendario[] | null = null;
  try {
    if (await googleConectado()) google = await leerEventosGoogle(desde, hasta);
  } catch {
    google = null;
  }
  if (google !== null) {
    // Google leyó bien → del teléfono solo los NO-google (evita duplicar el mismo evento).
    const delTel = telefonoActivo
      ? await leerEventos(desde, hasta, { excluirGoogle: true }).catch(() => [])
      : [];
    return { eventos: dedupEventos([...google, ...delTel]), usoGoogle: true };
  }
  const delTel = telefonoActivo ? await leerEventos(desde, hasta).catch(() => []) : [];
  return { eventos: dedupEventos(delTel), usoGoogle: false };
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null);

/**
 * Objetivos NUESTROS con horario que ocurren en [desdeISO, hastaExclusivoISO).
 * Expande las ocurrencias de los recurrentes día por día. Best-effort.
 * (Las tareas NO tienen horario → no aparecen en la agenda.)
 */
async function itemsAppEnRango(
  desdeISO: string,
  hastaExclusivoISO: string,
  excluirObjetivoId?: string,
): Promise<ItemAgenda[]> {
  const items: ItemAgenda[] = [];

  // Objetivos con horario (DAILY = una hora / SPECIFIC_DAYS = hora por día). WEEKLY_COUNT no.
  const objetivos = (await listarObjetivosConDias({ soloActivos: true }).catch(() => [])).filter(
    (o) => o.id_objetivo !== excluirObjetivoId, // excluir el que se está editando (no choca consigo mismo)
  );

  // Días OMITIDOS en el rango → su bloque no se muestra ese día (queda excusado).
  const omitidos = new Set<string>();
  try {
    const { data } = await supabase
      .from('registro_objetivo')
      .select('id_objetivo, fecha')
      .eq('omitido', true)
      .gte('fecha', desdeISO)
      .lt('fecha', hastaExclusivoISO);
    for (const r of data ?? []) omitidos.add(`${r.id_objetivo}:${String(r.fecha).slice(0, 10)}`);
  } catch {
    /* best-effort */
  }

  // Horarios EXCEPCIONALES por día (2.d). Consulta aparte + columnas nuevas → si aún no está la
  // migración, falla acá SIN afectar a los omitidos (queda el mapa vacío = horarios normales).
  const overrides = new Map<string, { hi: string; hf: string }>();
  try {
    const { data } = await (supabase.from('registro_objetivo') as any)
      .select('id_objetivo, fecha, hora_inicio, hora_fin')
      .not('hora_inicio', 'is', null)
      .gte('fecha', desdeISO)
      .lt('fecha', hastaExclusivoISO);
    for (const r of (data ?? []) as { id_objetivo: string; fecha: string; hora_inicio?: string | null; hora_fin?: string | null }[]) {
      const hi = hhmm(r.hora_inicio);
      const hf = hhmm(r.hora_fin);
      if (hi && hf) overrides.set(`${r.id_objetivo}:${String(r.fecha).slice(0, 10)}`, { hi, hf });
    }
  } catch {
    /* sin migración todavía → sin overrides */
  }
  for (const o of objetivos) {
    if (o.frecuencia_tipo === 'WEEKLY_COUNT') continue;
    const inicioBound = o.fecha_inicio ? o.fecha_inicio.slice(0, 10) : desdeISO;
    const finBound = o.fecha_fin ? o.fecha_fin.slice(0, 10) : null;
    const diaHi = hhmm(o.hora_inicio);
    const diaHf = hhmm(o.hora_fin);
    const porDia = new Map(o.horariosDia.map((h) => [h.dia, h]));

    for (let f = desdeISO; f < hastaExclusivoISO; f = sumarDiasISO(f, 1)) {
      if (f < inicioBound) continue;
      if (finBound && f > finBound) continue;
      const w = diaSemanaISO(f);
      let hi: string | null = null;
      let hf: string | null = null;
      if (o.frecuencia_tipo === 'DAILY') {
        hi = diaHi;
        hf = diaHf;
      } else if (o.dias.includes(w)) {
        const h = porDia.get(w);
        hi = hhmm(h?.hora_inicio);
        hf = hhmm(h?.hora_fin);
      }
      // Horario excepcional "solo ese día" (2.d): si hay override para esa fecha, pisa el normal.
      if (hi && hf) {
        const ov = overrides.get(`${o.id_objetivo}:${f}`);
        if (ov) {
          hi = ov.hi;
          hf = ov.hf;
        }
      }
      if (!hi || !hf) continue; // sin hora ese día → no es evento
      if (omitidos.has(`${o.id_objetivo}:${f}`)) continue; // omitido ese día → no se muestra
      items.push({
        id: `obj:${o.id_objetivo}:${f}`,
        titulo: o.nombre,
        inicio: `${f}T${hi}:00`,
        fin: `${f}T${hf}:00`,
        todoElDia: false,
        ubicacion: null,
        color: hexDeColor(o.color, COLOR_DRAGON),
        esApp: true,
        refObjetivoId: o.id_objetivo,
      });
    }
  }

  return items;
}

const COLOR_TAREA = '#e0912b'; // ámbar, para distinguir vencimientos de los objetivos-evento

/**
 * TAREAS que vencen en [desdeISO, hastaExclusivoISO), como ítems de vencimiento (no eventos).
 * Se muestran el día que vencen (con su hora límite si tiene). No se espejan a Google.
 */
async function tareasEnRango(desdeISO: string, hastaExclusivoISO: string): Promise<ItemAgenda[]> {
  const tareas = await listarTareas({ completadas: false }).catch(() => []);
  const items: ItemAgenda[] = [];
  for (const t of tareas) {
    if (!t.fecha_limite) continue;
    const f = t.fecha_limite.slice(0, 10);
    if (f < desdeISO || f >= hastaExclusivoISO) continue;
    const hl = hhmm(t.hora_limite);
    const hora = hl ?? '23:59'; // sin hora → al final del día (para ordenar)
    items.push({
      id: `tar:${t.id_tarea}`,
      titulo: t.titulo,
      inicio: `${f}T${hora}:00`,
      fin: `${f}T${hora}:00`,
      todoElDia: !hl, // sin hora límite → "vence" sin hora
      ubicacion: null,
      color: COLOR_TAREA,
      esApp: true,
      esTarea: true,
      refTareaId: t.id_tarea,
    });
  }
  return items;
}

/**
 * Ítems de una SEMANA (lunes→domingo), mezclando eventos externos + objetivos con horario +
 * tareas que vencen, agrupados por día. Best-effort: nunca lanza.
 *  · lunesISO: lunes de la semana a mostrar (default = semana actual). Permite navegar semanas.
 *  · interactivo=true → dispara el permiso si falta.
 */
/**
 * Núcleo compartido: arma los días de [desdeISO, finExclusivoISO) mezclando eventos externos +
 * objetivos con horario + tareas que vencen, agrupados por día. Devuelve también si leyó de Google.
 */
async function nucleoAgenda(
  desdeISO: string,
  finExclusivoISO: string,
  telefonoActivo: boolean,
): Promise<{ dias: DiaAgenda[]; usoGoogle: boolean }> {
  const hoy = hoyISO();
  const propios = await itemsAppEnRango(desdeISO, finExclusivoISO);
  const tareas = await tareasEnRango(desdeISO, finExclusivoISO);
  const { eventos: extEventos, usoGoogle } = await leerExternos(
    isoADate(desdeISO)!,
    isoADate(finExclusivoISO)!,
    telefonoActivo,
  );
  const externos: ItemAgenda[] = extEventos.map(externoAItem);

  const porDia = new Map<string, ItemAgenda[]>();
  for (const it of [...externos, ...propios, ...tareas]) {
    const dia = it.todoElDia ? it.inicio.slice(0, 10) : dateAISO(new Date(it.inicio));
    const lista = porDia.get(dia);
    if (lista) lista.push(it);
    else porDia.set(dia, [it]);
  }

  const dias: DiaAgenda[] = [];
  for (let f = desdeISO; f < finExclusivoISO; f = sumarDiasISO(f, 1)) {
    const itemsDia = (porDia.get(f) ?? []).sort((a, b) => a.inicio.localeCompare(b.inicio));
    dias.push({ fechaISO: f, esHoy: f === hoy, items: itemsDia });
  }
  return { dias, usoGoogle };
}

export async function eventosDeLaSemana(
  interactivo = false,
  lunesISO?: string,
): Promise<ResultadoAgenda> {
  const lunes = lunesISO ?? inicioSemanaISO(hoyISO());
  try {
    // interactivo = el usuario tocó "Conectar teléfono" → pedimos permiso y lo dejamos encendido.
    const telefonoActivo = interactivo ? await conectarTelefono() : await telefonoConectado();
    const finExclusivo = sumarDiasISO(lunes, 7);
    const { dias, usoGoogle } = await nucleoAgenda(lunes, finExclusivo, telefonoActivo);
    // Hay "fuente" de eventos si el teléfono está activo O si se leyó de Google.
    // Sin ninguna fuente igual mostramos objetivos + tareas; el aviso "conectar" aparece si falta.
    const hayFuente = telefonoActivo || usoGoogle;
    const hayPropios = dias.some((d) => d.items.length > 0);
    return {
      ok: hayFuente || hayPropios,
      motivo: hayFuente ? undefined : 'sin-permiso',
      lunesISO: lunes,
      dias,
    };
  } catch {
    return { ok: false, motivo: 'error', lunesISO: lunes, dias: [] };
  }
}

/**
 * Ítems de un RANGO arbitrario ([desdeISO, +cantidadDias)) agrupados por día. Para las vistas
 * de Día (1 día) y Mes (grilla de 6 semanas) de "Mi semana". Best-effort: nunca lanza.
 */
export async function agendaEnRango(desdeISO: string, cantidadDias: number): Promise<DiaAgenda[]> {
  try {
    const finExclusivo = sumarDiasISO(desdeISO, cantidadDias);
    const { dias } = await nucleoAgenda(desdeISO, finExclusivo, await telefonoConectado());
    return dias;
  } catch {
    return [];
  }
}

// ── Contexto para la IA: bloques ocupados ───────────────────────────────────

/**
 * Un compromiso concreto (fecha + rango) para que la IA no superponga.
 * 🔒 `fuente` distingue de dónde salió el bloque:
 *   · 'externo' = evento del calendario de Google/teléfono (DATO DE GOOGLE WORKSPACE).
 *   · 'app'     = objetivo/tarea propio (vive en nuestra base, NO es dato de Google).
 * Esto permite EXCLUIR lo 'externo' antes de mandar contexto a la IA (Limited Use de Google):
 * los datos de Google Calendar se usan solo en el dispositivo (aviso de superposición), nunca
 * se transfieren a la IA. Ver [[editar-google-calendar]] / política Limited Use.
 */
export type Compromiso = {
  titulo: string;
  fecha: string;
  desde: string;
  hasta: string;
  fuente: 'app' | 'externo';
};

/**
 * Bloques ocupados en los próximos `dias` (default 14) desde hoy: eventos externos con hora +
 * objetivos/tareas nuestros con horario. Best-effort: si algo falla, devuelve lo que pudo.
 * Cada bloque queda etiquetado con `fuente` (ver el tipo Compromiso). El filtro por origen para
 * la IA se hace en `organizarSemana` (lib/data/ia.ts).
 */
export async function compromisosDeContexto(dias = 14, excluirObjetivoId?: string): Promise<Compromiso[]> {
  const hoy = hoyISO();
  const finExclusivo = sumarDiasISO(hoy, dias);
  const salida: Compromiso[] = [];

  try {
    // Mismas dos fuentes que "Mi semana" (Google + teléfono, sin duplicar) → la IA no pisa eventos.
    const telefonoActivo = await telefonoConectado();
    const { eventos } = await leerExternos(isoADate(hoy)!, isoADate(finExclusivo)!, telefonoActivo);
    for (const e of eventos) {
      if (e.todoElDia) continue; // los de todo el día no bloquean franjas horarias
      const d = new Date(e.inicio);
      const df = new Date(e.fin);
      salida.push({
        titulo: e.titulo,
        fecha: dateAISO(d),
        desde: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        hasta: `${String(df.getHours()).padStart(2, '0')}:${String(df.getMinutes()).padStart(2, '0')}`,
        fuente: 'externo', // 🔒 dato de Google/teléfono → NO se manda a la IA
      });
    }
  } catch {
    // ignoramos: seguimos con los propios
  }

  try {
    const propios = await itemsAppEnRango(hoy, finExclusivo, excluirObjetivoId);
    for (const it of propios) {
      salida.push({
        titulo: it.titulo,
        fecha: it.inicio.slice(0, 10),
        desde: it.inicio.slice(11, 16),
        hasta: it.fin.slice(11, 16),
        fuente: 'app', // objetivo/tarea propio → sí se puede mandar a la IA
      });
    }
  } catch {
    // ignoramos
  }

  return salida.sort((a, b) => (a.fecha + a.desde).localeCompare(b.fecha + b.desde));
}

// ── Espejo al calendario "Drakostone" ───────────────────────────────────────

export type EspejoEvento =
  | { frecuencia: 'DAILY'; titulo: string; baseISO: string; horaInicio: string; horaFin: string; hastaISO?: string | null; colorId?: string | null }
  | {
      frecuencia: 'SPECIFIC_DAYS';
      titulo: string;
      baseISO: string;
      hastaISO?: string | null;
      colorId?: string | null;
      // una hora POR DÍA (ISO 1..7)
      dias: { dia: number; horaInicio: string; horaFin: string }[];
    }
  | { frecuencia: 'UNICO'; titulo: string; baseISO: string; horaInicio: string; horaFin: string; colorId?: string | null };

// Prefijo con el que marcamos los ids de eventos creados vía la API de Google (no el device
// calendar). Así `borrarEspejo`/omitir saben a qué backend pegarle. Un objetivo se crea entero
// en UN backend (según si Google está conectado al momento de crearlo), así que el string de
// `id_evento_calendario` es homogéneo.
const PFX_GOOGLE = 'g:';

/** Quita el prefijo `g:` de uno o varios ids coma-separados. */
function sinPrefijoGoogle(idStr: string): string {
  return idStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith(PFX_GOOGLE) ? s.slice(PFX_GOOGLE.length) : s))
    .join(',');
}

/** ¿El string de ids corresponde a eventos de la API de Google? */
function esEspejoGoogle(idStr: string): boolean {
  return idStr.trim().startsWith(PFX_GOOGLE);
}

type RecEspejo =
  | { frecuencia: 'DAILY'; hastaISO?: string | null }
  | { frecuencia: 'WEEKLY'; diaISO: number; hastaISO?: string | null }
  | null;

/**
 * Espeja el objetivo/tarea como evento(s) en el calendario y devuelve el/los id(s) (coma-separados)
 * o null. Para SPECIFIC_DAYS crea UN evento semanal POR DÍA a SU hora (más confiable que un evento
 * multi-día, que Android a veces repite solo en el día de inicio).
 *
 * Rutea el backend según la conexión: si el usuario conectó Google Calendar → API de Google (con
 * el `colorId` real, ids prefijados `g:`); si no → calendario del dispositivo (expo-calendar), como
 * antes. La experiencia es idéntica (los objetivos propios se dibujan desde nuestra base, no del
 * calendario). Best-effort: si no hay permiso/sesión, no espeja.
 */
export async function espejarEnCalendario(ev: EspejoEvento): Promise<string | null> {
  try {
    const usarGoogle = await googleConectado();

    // Destino del device calendar (solo si NO usamos Google).
    let capaId: string | null = null;
    if (!usarGoogle) {
      if (!(await permisoCalendario())) return null;
      const { data } = await supabase.auth.getUser();
      const capa = await calendarioDestino(data.user?.email ?? undefined);
      if (!capa) return null;
      capaId = capa.id;
    }

    const crearEn = async (
      fechaISO: string,
      horaInicio: string,
      horaFin: string,
      recurrencia: RecEspejo,
    ): Promise<string | null> => {
      const inicio = new Date(`${fechaISO}T${horaInicio}:00`);
      const fin = new Date(`${fechaISO}T${horaFin}:00`);
      if (!(fin.getTime() > inicio.getTime())) return null;
      if (usarGoogle) {
        const id = await crearEventoGoogle({
          titulo: ev.titulo,
          inicio,
          fin,
          colorId: ev.colorId ?? null,
          recurrencia,
        });
        return id ? PFX_GOOGLE + id : null;
      }
      return crearEventoDragon(capaId!, { titulo: ev.titulo, inicio, fin, recurrencia });
    };

    const ids: string[] = [];
    if (ev.frecuencia === 'DAILY') {
      const id = await crearEn(ev.baseISO, ev.horaInicio, ev.horaFin, {
        frecuencia: 'DAILY',
        hastaISO: ev.hastaISO,
      });
      if (id) ids.push(id);
    } else if (ev.frecuencia === 'SPECIFIC_DAYS') {
      for (const d of ev.dias) {
        const primera = primeraFechaOcurrencia(ev.baseISO, [d.dia]);
        const id = await crearEn(primera, d.horaInicio, d.horaFin, {
          frecuencia: 'WEEKLY',
          diaISO: d.dia,
          hastaISO: ev.hastaISO,
        });
        if (id) ids.push(id);
      }
    } else {
      const id = await crearEn(ev.baseISO, ev.horaInicio, ev.horaFin, null); // evento único (tarea)
      if (id) ids.push(id);
    }
    return ids.length ? ids.join(',') : null;
  } catch {
    return null;
  }
}

/**
 * Limpia TODOS los eventos 🐉 con este nombre en el backend activo (Google si está conectado, si no
 * el teléfono). Es la defensa contra duplicados/huérfanos: se llama ANTES de re-espejar, así no
 * importa si se perdieron ids — igual queda un solo juego de eventos. Best-effort.
 */
export async function limpiarEspejosDe(nombre: string): Promise<void> {
  // Limpiamos en AMBOS backends disponibles (no solo el activo): un objetivo pudo haber dejado
  // eventos en Google (build con Google) y en el teléfono (build sin Google) con la misma cuenta.
  try {
    if (await googleConectado()) await borrarEventosGooglePorTitulo(nombre);
  } catch {
    /* best-effort */
  }
  try {
    if (await permisoCalendario()) await borrarEventosDragonPorTitulo(nombre);
  } catch {
    /* best-effort */
  }
}

/** Borra el evento espejo (best-effort), ruteando al backend según el prefijo del id. */
export async function borrarEspejo(idEvento: string | null | undefined): Promise<void> {
  if (!idEvento) return;
  if (esEspejoGoogle(idEvento)) await borrarEventoGoogle(sinPrefijoGoogle(idEvento));
  else await borrarEventoDragon(idEvento);
}

/** Borra UNA ocurrencia (best-effort), ruteando al backend según el prefijo del id. */
async function borrarOcurrenciaEspejo(idEvento: string, inicioOcurrencia: Date): Promise<void> {
  if (esEspejoGoogle(idEvento)) await borrarOcurrenciaGoogle(sinPrefijoGoogle(idEvento), inicioOcurrencia);
  else await borrarOcurrenciaDragon(idEvento, inicioOcurrencia);
}

/**
 * Mueve UNA ocurrencia a otro horario (best-effort), ruteando por el prefijo del id.
 * ⚠️ En el calendario del TELÉFONO NO se mueve la ocurrencia: `updateEventAsync` sobre una instancia
 * de un evento recurrente crashea en Android ("Cannot have both DTEND and DURATION"). Por eso, para
 * el device el cambio queda SOLO en la app; en Google (que no tiene ese problema) sí se refleja.
 */
async function actualizarOcurrenciaEspejo(
  idEvento: string,
  inicioOriginal: Date,
  nuevoInicio: Date,
  nuevoFin: Date,
): Promise<boolean> {
  if (esEspejoGoogle(idEvento))
    return actualizarOcurrenciaGoogle(sinPrefijoGoogle(idEvento), inicioOriginal, nuevoInicio, nuevoFin);
  return false; // device: no tocamos la ocurrencia (evita el crash); el override vive en la app.
}

// ── Omitir un día y reflejarlo en el calendario de Google ────────────────────

/** Hora de inicio del objetivo en un día ISO puntual, o null si ese día no lleva bloque. */
function horaInicioEnFecha(o: ObjetivoConDias, fechaISO: string): string | null {
  if (o.frecuencia_tipo === 'DAILY') return hhmm(o.hora_inicio);
  if (o.frecuencia_tipo === 'SPECIFIC_DAYS') {
    const w = diaSemanaISO(fechaISO);
    if (!o.dias.includes(w)) return null;
    return hhmm(o.horariosDia.find((x) => x.dia === w)?.hora_inicio);
  }
  return null;
}

/** Hora de fin del objetivo en un día ISO puntual, o null si ese día no lleva bloque. */
function horaFinEnFecha(o: ObjetivoConDias, fechaISO: string): string | null {
  if (o.frecuencia_tipo === 'DAILY') return hhmm(o.hora_fin);
  if (o.frecuencia_tipo === 'SPECIFIC_DAYS') {
    const w = diaSemanaISO(fechaISO);
    if (!o.dias.includes(w)) return null;
    return hhmm(o.horariosDia.find((x) => x.dia === w)?.hora_fin);
  }
  return null;
}

/**
 * Parte A (2.d): cambia el horario de un objetivo SOLO ese día EN LA APP y lo refleja moviendo la
 * ocurrencia en el calendario (esa fecha solamente; el resto de los días queda igual). `hi/hf` = null
 * → vuelve al horario normal (mueve la ocurrencia de vuelta). El cambio en la app se guarda SIEMPRE;
 * el calendario es best-effort (si falla, no rompe nada).
 */
export async function cambiarHorarioDiaYReflejar(
  idObjetivo: string,
  fechaISO: string,
  hi: string | null,
  hf: string | null,
): Promise<void> {
  await setHorarioDia(idObjetivo, fechaISO, hi, hf); // 🔒 app-side siempre
  try {
    const o = await obtenerObjetivo(idObjetivo);
    if (!o || !o.id_evento_calendario) return;
    const normalHi = horaInicioEnFecha(o, fechaISO);
    const normalHf = horaFinEnFecha(o, fechaISO);
    if (!normalHi || !normalHf) return; // ese día no lleva bloque → nada que mover
    const original = new Date(`${fechaISO}T${normalHi}:00`); // Google/teléfono identifican por el original
    const nuevoInicio = new Date(`${fechaISO}T${hi ?? normalHi}:00`);
    const nuevoFin = new Date(`${fechaISO}T${hf ?? normalHf}:00`);
    await actualizarOcurrenciaEspejo(o.id_evento_calendario, original, nuevoInicio, nuevoFin);
  } catch {
    // best-effort: el override en la app ya quedó guardado.
  }
}

/** Arma el EspejoEvento de un objetivo con horario (o null si no tiene bloque). */
function espejoDeObjetivo(o: ObjetivoConDias): EspejoEvento | null {
  const base = (o.fecha_inicio ?? hoyISO()).slice(0, 10);
  const hasta = o.fecha_fin ? o.fecha_fin.slice(0, 10) : null;
  if (o.frecuencia_tipo === 'DAILY') {
    const hi = hhmm(o.hora_inicio);
    const hf = hhmm(o.hora_fin);
    if (!hi || !hf) return null;
    return { frecuencia: 'DAILY', titulo: o.nombre, baseISO: base, horaInicio: hi, horaFin: hf, hastaISO: hasta, colorId: o.color };
  }
  if (o.frecuencia_tipo === 'SPECIFIC_DAYS') {
    const dias = o.horariosDia
      .filter((h) => hhmm(h.hora_inicio) && hhmm(h.hora_fin))
      .map((h) => ({ dia: h.dia, horaInicio: hhmm(h.hora_inicio)!, horaFin: hhmm(h.hora_fin)! }));
    if (dias.length === 0) return null;
    return { frecuencia: 'SPECIFIC_DAYS', titulo: o.nombre, baseISO: base, hastaISO: hasta, colorId: o.color, dias };
  }
  return null; // WEEKLY_COUNT no lleva calendario
}

/**
 * Omite (o deshace) un objetivo en un día Y lo refleja en el calendario de Google:
 *  · omitir  → borra esa ocurrencia del evento recurrente (best-effort).
 *  · deshacer → como Google NO puede "restaurar" una ocurrencia borrada, RECREA el evento entero
 *    y vuelve a ocultar los demás días que sigan omitidos.
 * La parte de calendario es best-effort: si falla, la omisión igual queda guardada.
 */
export async function omitirYReflejar(
  idObjetivo: string,
  fechaISO: string,
  omitir: boolean,
  razon?: string | null,
): Promise<void> {
  await omitirObjetivo(idObjetivo, fechaISO, omitir, razon);

  const o = await obtenerObjetivo(idObjetivo).catch(() => null);
  if (!o || !o.id_evento_calendario) return; // sin bloque en calendario → nada que reflejar
  const espejo = espejoDeObjetivo(o);
  if (!espejo) return;

  try {
    if (omitir) {
      const hi = horaInicioEnFecha(o, fechaISO);
      if (hi) await borrarOcurrenciaEspejo(o.id_evento_calendario, new Date(`${fechaISO}T${hi}:00`));
      return;
    }

    // DESHACER → recrear el evento entero y re-ocultar los días que sigan omitidos.
    await borrarEspejo(o.id_evento_calendario);
    const nuevos = await espejarEnCalendario(espejo);
    await actualizarObjetivo(idObjetivo, { id_evento_calendario: nuevos });
    if (!nuevos) return;

    const { data } = await supabase
      .from('registro_objetivo')
      .select('fecha')
      .eq('id_objetivo', idObjetivo)
      .eq('omitido', true);
    for (const r of data ?? []) {
      const f = String(r.fecha).slice(0, 10);
      if (f === fechaISO) continue; // el que estamos deshaciendo no se re-oculta
      const hi = horaInicioEnFecha(o, f);
      if (hi) await borrarOcurrenciaEspejo(nuevos, new Date(`${f}T${hi}:00`));
    }
  } catch {
    // best-effort: la omisión ya quedó guardada; el calendario se puede reintentar
  }
}

/**
 * "Dejar de hacer" un objetivo DE HOY EN ADELANTE, SIN borrar el historial (opción "de hoy en
 * adelante" del menú de eliminar):
 *  · pone `fecha_fin = ayer` → deja de generarse desde hoy (Hoy, Mi semana y Progreso a futuro),
 *    pero los días ya cumplidos siguen contando 🔒 (Hoy/Progreso filtran `fecha_fin >= fecha`, así
 *    que el pasado queda dentro del rango y el objetivo sigue `activo`).
 *  · corta el evento del calendario para que no aparezca a futuro (lo recrea terminando ayer; si el
 *    objetivo arrancaba hoy o después, solo borra el espejo).
 * Para borrar TODO (incluido el historial) usar `eliminarObjetivo`.
 */
/**
 * "Dejar de hacer" un objetivo desde hoy: corta con fecha_fin = ayer. SOLO la escritura esencial
 * (rápida) para que la pantalla salga al instante. El calendario se ajusta aparte, en segundo plano
 * (ver `reflejarCorteEnCalendario`), porque son llamadas de red lentas que si no trabarían la salida.
 */
export async function dejarDeHacerObjetivo(idObjetivo: string): Promise<void> {
  const ayer = sumarDiasISO(hoyISO(), -1);
  await actualizarObjetivo(idObjetivo, { fecha_fin: ayer });
}

/** Ajusta el espejo del calendario tras cortar un objetivo (best-effort, para correr en 2º plano). */
export async function reflejarCorteEnCalendario(idObjetivo: string): Promise<void> {
  const ayer = sumarDiasISO(hoyISO(), -1);
  const o = await obtenerObjetivo(idObjetivo).catch(() => null);
  if (!o) return;
  try {
    if (o.id_evento_calendario) await borrarEspejo(o.id_evento_calendario);
    await limpiarEspejosDe(o.nombre); // anti-duplicados (huérfanos con ids perdidos)
    const base = (o.fecha_inicio ?? hoyISO()).slice(0, 10);
    // Solo recreamos el espejo si el objetivo había arrancado antes de hoy (rango válido hasta ayer).
    const espejo = base <= ayer ? espejoDeObjetivo({ ...o, fecha_fin: ayer }) : null;
    const nuevos = espejo ? await espejarEnCalendario(espejo) : null;
    await actualizarObjetivo(idObjetivo, { id_evento_calendario: nuevos });
  } catch {
    // best-effort: el corte (fecha_fin) ya quedó guardado; el calendario se puede reintentar.
  }
}

/**
 * Re-sincroniza al calendario los objetivos con horario que quedaron SIN evento espejo
 * (`id_evento_calendario` vacío): se crearon antes de la función de calendario, sin permiso, o el
 * espejo falló. Recorre los activos con horario y a futuro, y los espeja. Devuelve cuántos sincronizó.
 * Best-effort: si no hay permiso/conexión, `espejarEnCalendario` devuelve null y no pasa nada.
 * Ideal para llamar al CONECTAR un calendario (Mi semana / Perfil).
 */
export async function sincronizarObjetivosSinEspejo(): Promise<number> {
  const objetivos = await listarObjetivosConDias({ soloActivos: true }).catch(() => []);
  const hoy = hoyISO();
  let n = 0;
  for (const o of objetivos) {
    if (o.id_evento_calendario) continue; // ya tiene evento
    if (o.fecha_fin && o.fecha_fin.slice(0, 10) < hoy) continue; // terminado → no va a futuro
    const espejo = espejoDeObjetivo(o);
    if (!espejo) continue; // sin horario → no lleva calendario
    try {
      await limpiarEspejosDe(o.nombre); // anti-duplicados antes de crear
      const ids = await espejarEnCalendario(espejo);
      if (ids) {
        await actualizarObjetivo(o.id_objetivo, { id_evento_calendario: ids });
        n++;
      }
    } catch {
      // best-effort: seguimos con los demás
    }
  }
  return n;
}

/**
 * REPARA el calendario: por CADA objetivo con horario (tenga o no id guardado), borra TODOS sus
 * eventos 🐉 del calendario y crea UN solo juego limpio. Sirve para eliminar duplicados/triplicados
 * que ya quedaron (p. ej. por sincronizar en varios teléfonos). Devuelve cuántos objetivos reparó.
 * Best-effort: nunca lanza; los que no se pudieron, quedan como estaban.
 */
export async function repararEspejosCalendario(): Promise<number> {
  const objetivos = await listarObjetivosConDias({ soloActivos: true }).catch(() => []);
  const hoy = hoyISO();
  let n = 0;
  for (const o of objetivos) {
    if (o.fecha_fin && o.fecha_fin.slice(0, 10) < hoy) continue; // terminado → no va a futuro
    const espejo = espejoDeObjetivo(o);
    if (!espejo) continue; // sin horario → no lleva calendario
    try {
      await limpiarEspejosDe(o.nombre); // borra TODOS los 🐉 de ese nombre (ahora confiable, sin `q=`)
      const ids = await espejarEnCalendario(espejo);
      await actualizarObjetivo(o.id_objetivo, { id_evento_calendario: ids ?? null });
      n++;
    } catch {
      // best-effort: seguimos con los demás
    }
  }
  return n;
}

// ── Doble vía: leer los cambios hechos EN el calendario y traerlos al objetivo (1.a/1.b) ──

/** Estado de un id espejo (con prefijo `g:` para Google, o id de dispositivo). null = no se pudo leer. */
async function estadoDeId(rawId: string): Promise<EstadoEvento | null> {
  const t = rawId.trim();
  if (!t) return null;
  if (t.startsWith('g:')) return estadoEventoGoogle(t.slice(2));
  return estadoEventoDragon(t);
}

const DIA_CORTO = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // índice = ISO 1..7

/** Un cambio detectado en el calendario, para MOSTRAR y (si la usuaria confirma) aplicar al objetivo. */
export type CambioCalendario = {
  idObjetivo: string;
  titulo: string;
  tipo: 'baja' | 'hora' | 'dias' | 'hora-dia';
  descripcion: string;
  horaInicio?: string;
  horaFin?: string;
  dias?: DiaHorario[];
  idsVivos?: string; // ids de eventos que siguen vivos (para 'dias')
  fecha?: string; // fecha puntual (para 'hora-dia')
};

/** Detecta el cambio de UN objetivo respecto de su(s) evento(s) en el calendario, SIN aplicar nada. */
async function detectarCambioObjetivo(o: ObjetivoConDias): Promise<CambioCalendario | null> {
  const ids = (o.id_evento_calendario ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return null;
  const estados = await Promise.all(ids.map(estadoDeId));
  if (estados.some((e) => e === null)) return null; // algún dato incierto → no proponemos nada
  const est = estados as EstadoEvento[];
  const base = { idObjetivo: o.id_objetivo, titulo: o.nombre };

  if (o.frecuencia_tipo === 'DAILY') {
    const e = est[0];
    if (!e.existe) return { ...base, tipo: 'baja', descripcion: 'lo borraste del calendario' };
    if (e.horaInicio && e.horaFin && (e.horaInicio !== hhmm(o.hora_inicio) || e.horaFin !== hhmm(o.hora_fin)))
      return { ...base, tipo: 'hora', descripcion: `nuevo horario ${e.horaInicio}–${e.horaFin}`, horaInicio: e.horaInicio, horaFin: e.horaFin };
    return null;
  }

  if (o.frecuencia_tipo === 'SPECIFIC_DAYS') {
    const vivos: DiaHorario[] = [];
    const idsVivos: string[] = [];
    est.forEach((e, i) => {
      if (!e.existe || e.diaISO == null) return;
      const previa = o.horariosDia.find((h) => h.dia === e.diaISO);
      vivos.push({ dia: e.diaISO, hora_inicio: e.horaInicio ?? previa?.hora_inicio ?? null, hora_fin: e.horaFin ?? previa?.hora_fin ?? null });
      idsVivos.push(ids[i]);
    });
    if (vivos.length === 0) return { ...base, tipo: 'baja', descripcion: 'lo borraste del calendario' };
    const clave = (ds: { dia: number; hora_inicio?: string | null; hora_fin?: string | null }[]) =>
      JSON.stringify(ds.map((d) => [d.dia, hhmm(d.hora_inicio ?? null), hhmm(d.hora_fin ?? null)]).sort());
    if (clave(vivos) === clave(o.horariosDia)) return null;
    const orden = [...vivos].sort((a, b) => a.dia - b.dia);
    const desc = `nuevos días: ${orden.map((d) => DIA_CORTO[d.dia] + (d.hora_inicio ? ` ${hhmm(d.hora_inicio)}` : '')).join(', ')}`;
    return { ...base, tipo: 'dias', descripcion: desc, dias: vivos, idsVivos: idsVivos.join(',') };
  }
  return null;
}

/** Instancias 🐉 de un objetivo en la ventana, del backend activo. null = no se pudo leer. */
async function instanciasEspejoDe(
  nombre: string,
  desde: Date,
  hasta: Date,
): Promise<{ fecha: string; hi: string; hf: string }[] | null> {
  if (await googleConectado()) return instanciasGooglePorTitulo(nombre, desde, hasta);
  if (await permisoCalendario()) return instanciasDragonPorTitulo(nombre, desde, hasta);
  return null;
}

/** Overrides de horario por día (registro_objetivo) de un objetivo en [desde, hasta]. */
async function overridesDe(
  idObjetivo: string,
  desdeISO: string,
  hastaISO: string,
): Promise<Map<string, { hi: string; hf: string }>> {
  const m = new Map<string, { hi: string; hf: string }>();
  try {
    const { data } = await (supabase.from('registro_objetivo') as any)
      .select('fecha, hora_inicio, hora_fin')
      .eq('id_objetivo', idObjetivo)
      .not('hora_inicio', 'is', null)
      .gte('fecha', desdeISO)
      .lte('fecha', hastaISO);
    for (const r of (data ?? []) as { fecha: string; hora_inicio?: string | null; hora_fin?: string | null }[]) {
      const hi = hhmm(r.hora_inicio);
      const hf = hhmm(r.hora_fin);
      if (hi && hf) m.set(String(r.fecha).slice(0, 10), { hi, hf });
    }
  } catch {
    /* sin migración → sin overrides */
  }
  return m;
}

/**
 * Detecta cambios de UNA SOLA ocurrencia (un día puntual) hechos en el calendario → propone horarios
 * "solo ese día". Compara cada instancia del calendario contra lo que la app muestra ese día
 * (override si hay, si no el horario normal). Ventana acotada alrededor de hoy. Best-effort.
 */
async function detectarCambiosOcurrencia(o: ObjetivoConDias): Promise<CambioCalendario[]> {
  const hoy = hoyISO();
  const desdeISO = sumarDiasISO(hoy, -14);
  const hastaISO = sumarDiasISO(hoy, 21);
  const instancias = await instanciasEspejoDe(o.nombre, isoADate(desdeISO)!, isoADate(hastaISO)!);
  if (instancias === null || instancias.length === 0) return []; // no se pudo leer / no hay → nada
  const overrides = await overridesDe(o.id_objetivo, desdeISO, hastaISO);
  const base = { idObjetivo: o.id_objetivo, titulo: o.nombre };

  // Agrupamos las instancias del calendario por día de la semana (DAILY = un único grupo, clave 0).
  const grupos = new Map<number, { fecha: string; hi: string; hf: string }[]>();
  for (const inst of instancias) {
    const w = o.frecuencia_tipo === 'DAILY' ? 0 : diaSemanaISO(inst.fecha);
    const g = grupos.get(w);
    if (g) g.push(inst);
    else grupos.set(w, [inst]);
  }

  const perDia: CambioCalendario[] = [];
  const nuevosDias: DiaHorario[] = []; // por si hay cambio de SERIE: cada día con su hora predominante
  let serieCambio = false;

  for (const [w, insts] of grupos) {
    const stHi = o.frecuencia_tipo === 'DAILY' ? hhmm(o.hora_inicio) : hhmm(o.horariosDia.find((x) => x.dia === w)?.hora_inicio);
    const stHf = o.frecuencia_tipo === 'DAILY' ? hhmm(o.hora_fin) : hhmm(o.horariosDia.find((x) => x.dia === w)?.hora_fin);
    if (!stHi || !stHf) continue; // ese día no lleva bloque normal → ignorar

    // Horario PREDOMINANTE (moda) del calendario para ese día de la semana.
    const conteo = new Map<string, number>();
    for (const i of insts) {
      const k = `${i.hi}|${i.hf}`;
      conteo.set(k, (conteo.get(k) ?? 0) + 1);
    }
    let modeKey = `${stHi}|${stHf}`;
    let modeN = 0;
    for (const [k, n] of conteo) if (n > modeN) { modeKey = k; modeN = n; }
    const [mHi, mHf] = modeKey.split('|');
    // Si el predominante NO es el guardado y se repite (≥2), la SERIE de ese día se movió a mHi–mHf.
    const serieShift = (mHi !== stHi || mHf !== stHf) && modeN >= 2;
    if (serieShift) serieCambio = true;
    nuevosDias.push({ dia: w, hora_inicio: serieShift ? mHi : stHi, hora_fin: serieShift ? mHf : stHf });

    // Excepciones de un día: instancias que difieren de lo que la app mostraría ese día
    // (override si hay; si no, la hora predominante del día).
    const efDia = serieShift ? { hi: mHi, hf: mHf } : { hi: stHi, hf: stHf };
    for (const i of insts) {
      const ef = overrides.get(i.fecha) ?? efDia;
      if (i.hi === ef.hi && i.hf === ef.hf) continue;
      perDia.push({
        ...base,
        tipo: 'hora-dia',
        descripcion: `${DIA_CORTO[diaSemanaISO(i.fecha)]} ${Number(i.fecha.slice(8))}: nuevo horario ${i.hi}–${i.hf}`,
        fecha: i.fecha,
        horaInicio: i.hi,
        horaFin: i.hf,
      });
    }
  }

  const cambios: CambioCalendario[] = [];
  if (serieCambio) {
    // Cambiaste el horario de (una parte de) la serie en el calendario → UN solo cambio, no día por día.
    if (o.frecuencia_tipo === 'DAILY') {
      const d = nuevosDias[0];
      if (d?.hora_inicio && d?.hora_fin)
        cambios.push({ ...base, tipo: 'hora', descripcion: `nuevo horario ${d.hora_inicio}–${d.hora_fin}`, horaInicio: d.hora_inicio, horaFin: d.hora_fin });
    } else {
      const desc = nuevosDias.map((d) => `${DIA_CORTO[d.dia]} ${hhmm(d.hora_inicio ?? null)}`).join(', ');
      cambios.push({ ...base, tipo: 'dias', descripcion: `nuevos horarios: ${desc}`, dias: nuevosDias, idsVivos: o.id_evento_calendario ?? undefined });
    }
  }
  return [...cambios, ...perDia];
}

/**
 * Detecta TODOS los cambios que hiciste EN el calendario (borrar, editar hora/días de la serie, o
 * mover un día suelto) respecto de tus objetivos, SIN aplicar nada. La UI los muestra y vos elegís.
 * 🔒 Seguridad: si NO se puede leer con certeza, ese objetivo no genera propuesta.
 */
export async function detectarCambiosCalendario(): Promise<CambioCalendario[]> {
  const objetivos = await listarObjetivosConDias({ soloActivos: true }).catch(() => []);
  const hoy = hoyISO();
  const cambios: CambioCalendario[] = [];
  for (const o of objetivos) {
    if (!o.id_evento_calendario) continue;
    if (o.frecuencia_tipo === 'WEEKLY_COUNT') continue;
    if (o.fecha_fin && o.fecha_fin.slice(0, 10) < hoy) continue;
    try {
      const c = await detectarCambioObjetivo(o);
      if (c) {
        cambios.push(c);
        continue; // cambio de SERIE → no miramos ocurrencias sueltas (evita doble propuesta)
      }
      cambios.push(...(await detectarCambiosOcurrencia(o)));
    } catch {
      // best-effort
    }
  }
  return cambios;
}

/** Aplica SOLO los cambios confirmados. 🔒 Las bajas conservan el historial (fecha_fin = ayer). */
export async function aplicarCambiosCalendario(cambios: CambioCalendario[]): Promise<void> {
  const ayer = sumarDiasISO(hoyISO(), -1);
  for (const c of cambios) {
    try {
      if (c.tipo === 'baja') {
        await actualizarObjetivo(c.idObjetivo, { fecha_fin: ayer, id_evento_calendario: null });
      } else if (c.tipo === 'hora' && c.horaInicio && c.horaFin) {
        await actualizarObjetivo(c.idObjetivo, { hora_inicio: c.horaInicio, hora_fin: c.horaFin });
      } else if (c.tipo === 'dias' && c.dias) {
        // Los eventos vivos del calendario ya reflejan los días/horas → solo alineamos el objetivo.
        await setDiasObjetivo(c.idObjetivo, c.dias);
        await actualizarObjetivo(c.idObjetivo, { id_evento_calendario: c.idsVivos ?? null });
      } else if (c.tipo === 'hora-dia' && c.fecha && c.horaInicio && c.horaFin) {
        // Cambio de un día suelto: el calendario ya lo tiene → solo guardamos el override en la app.
        await setHorarioDia(c.idObjetivo, c.fecha, c.horaInicio, c.horaFin);
      }
    } catch {
      // best-effort por cambio
    }
  }
}

/** ¿La app ya tiene permiso de calendario? (para avisos en la UI). */
export { permisoCalendario, pedirPermisoCalendario };
// Conectar/desconectar el calendario del teléfono (preferencia local on/off) — para Mi semana y Perfil.
export { telefonoConectado, conectarTelefono, desconectarTelefono };

// Conexión a Google Calendar (Fase B), re-exportada para que la UI la use vía @/lib/data.
// (googleConectado ya está importado arriba para uso interno → se re-exporta como binding local.)
export { conectarGoogleCalendar, desconectarGoogle, googleConfigurado } from '../google-calendar';
export { googleConectado };
