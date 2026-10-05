// Puente ÚNICO al módulo nativo de calendario (como lib/health.ts / lib/notificaciones.ts).
// Lee el CALENDARIO DEL DISPOSITIVO (expo-calendar), que ya incluye los eventos de Google
// sincronizados por el SO. NO usa la API de Google Calendar (evita su verificación de OAuth).
// Además ESCRIBE los "objetivos con horario" como eventos en el calendario PRINCIPAL de Google
// del usuario (Android no deja crear una capa dedicada que sincronice; solo Google puede).
// Para distinguirlos, sus títulos llevan el prefijo MARCA "🐉 " (y así también se filtran al
// leer, para no duplicarlos con lo que ya sale de nuestra base).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';

/** Prefijo que marca los eventos creados por la app (para distinguir y deduplicar). */
export const MARCA_DRAGON = '🐉 ';

// El permiso del SISTEMA no se puede revocar por código, así que modelamos el calendario del
// teléfono como una preferencia local on/off (un "conectar/desconectar" real dentro de la app):
// desconectar = la app deja de leer el calendario del teléfono, aunque el permiso del SO siga.
const K_USAR_TELEFONO = 'usar_calendario_telefono_v1';

async function telefonoApagado(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(K_USAR_TELEFONO)) === 'off';
  } catch {
    return false;
  }
}

/** ¿La fuente "calendario del teléfono" está activa? = permiso concedido Y no apagada por el usuario. */
export async function telefonoConectado(): Promise<boolean> {
  if (await telefonoApagado()) return false;
  return permisoCalendario();
}

/** Conectar el calendario del teléfono: pide permiso al SO y lo marca encendido. */
export async function conectarTelefono(): Promise<boolean> {
  const ok = await pedirPermisoCalendario();
  try {
    await AsyncStorage.setItem(K_USAR_TELEFONO, ok ? 'on' : 'off');
  } catch {
    /* si no se pudo guardar la preferencia, igual devolvemos el resultado del permiso */
  }
  return ok;
}

/** Desconectar: la app deja de leer el calendario del teléfono (el permiso del SO se mantiene). */
export async function desconectarTelefono(): Promise<void> {
  try {
    await AsyncStorage.setItem(K_USAR_TELEFONO, 'off');
  } catch {
    /* best-effort */
  }
}

/** Un evento del calendario, normalizado y sin dependencias del nativo. */
export type EventoCalendario = {
  id: string;
  titulo: string;
  inicio: string; // ISO
  fin: string; // ISO
  todoElDia: boolean;
  ubicacion: string | null;
  /** Color del calendario de origen (para un puntito en la UI). */
  color: string | null;
  /** id del calendario de origen (para excluir el nuestro al leer eventos externos). */
  idCalendario: string;
};

/** ¿Ya tenemos permiso de lectura del calendario? */
export async function permisoCalendario(): Promise<boolean> {
  const { granted } = await Calendar.getCalendarPermissionsAsync();
  return granted;
}

/** Pide el permiso de calendario (dispara el diálogo del sistema). */
export async function pedirPermisoCalendario(): Promise<boolean> {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  return granted;
}

function aISO(v: string | Date): string {
  return typeof v === 'string' ? v : v.toISOString();
}

/**
 * Eventos entre `desde` y `hasta` (Date, hora local) de los calendarios del dispositivo.
 * Por defecto EXCLUYE los eventos creados por la app (título con MARCA "🐉 "), porque esos
 * ya salen de nuestra base y se verían duplicados. Asume permiso ya concedido.
 */
export async function leerEventos(
  desde: Date,
  hasta: Date,
  opciones: { incluirDragon?: boolean; excluirGoogle?: boolean } = {},
): Promise<EventoCalendario[]> {
  const todos = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  // Si Google Calendar está conectado por su API, leemos SUS eventos de ahí (todos los calendarios,
  // no solo los que el teléfono sincroniza) → excluimos los calendarios de Google del dispositivo
  // para no DUPLICAR el mismo evento (una vez por la API y otra por el teléfono).
  const calendarios = opciones.excluirGoogle
    ? todos.filter((c) => c.source?.type !== 'com.google')
    : todos;
  if (calendarios.length === 0) return [];

  const colorPorId = new Map(calendarios.map((c) => [c.id, c.color ?? null]));
  const eventos = await Calendar.getEventsAsync(
    calendarios.map((c) => c.id),
    desde,
    hasta,
  );

  return eventos
    .filter((e) => opciones.incluirDragon || !(e.title ?? '').startsWith(MARCA_DRAGON))
    .map((e) => ({
      id: e.id,
      titulo: (e.title ?? '').replace(MARCA_DRAGON, '').trim() || '(sin título)',
      inicio: aISO(e.startDate),
      fin: aISO(e.endDate),
      todoElDia: !!e.allDay,
      ubicacion: e.location?.trim() || null,
      color: colorPorId.get(e.calendarId) ?? null,
      idCalendario: e.calendarId,
    }));
}

// ── Escritura: capa "Drakostone" ────────────────────────────────────────────

export type CalendarioDestino = {
  id: string;
  /** true si escribe en una cuenta de Google (sincroniza a la web / otros equipos). */
  sincronizaGoogle: boolean;
  /** cuenta/calendario elegido, para mostrarle al usuario dónde se agenda. */
  nombre: string;
};

/**
 * Elige el calendario donde ESCRIBIR los eventos: preferimos el PRINCIPAL de Google del usuario
 * (para que sincronice con la web), priorizando la cuenta `preferirEmail` (la de la app) para no
 * caer en otra cuenta de Google. Si no hay Google escribible, usamos cualquiera modificable.
 * Devuelve null si no hay ninguno (sin permiso, sin cuentas).
 */
export async function calendarioDestino(preferirEmail?: string): Promise<CalendarioDestino | null> {
  try {
    const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const mods = calendarios.filter((c) => c.allowsModifications);
    if (mods.length === 0) return null;

    const google = mods.filter((c) => c.source?.type === 'com.google');
    const esPrimario = (c: (typeof mods)[number]) => (c as { isPrimary?: boolean }).isPrimary === true;

    const elegido =
      (preferirEmail &&
        (google.find((c) => c.source?.name === preferirEmail && esPrimario(c)) ??
          google.find((c) => c.source?.name === preferirEmail))) ||
      google.find(esPrimario) ||
      google[0] ||
      mods[0];

    return {
      id: elegido.id,
      sincronizaGoogle: elegido.source?.type === 'com.google',
      nombre: elegido.source?.name ?? elegido.title,
    };
  } catch {
    return null;
  }
}

/** Día ISO (1=lunes..7=domingo) → enum de expo-calendar (1=domingo..7=sábado). */
function isoADiaExpo(iso: number): number {
  return iso === 7 ? 1 : iso + 1;
}

/**
 * Recurrencia de UN evento. WEEKLY es de UN SOLO día (más confiable que multi-día: Android
 * a veces ignora los días extra y repite solo el de inicio). Para varios días se crean varios eventos.
 */
export type Recurrencia =
  | { frecuencia: 'DAILY'; hastaISO?: string | null }
  | { frecuencia: 'WEEKLY'; diaISO: number; hastaISO?: string | null };

export type NuevoEvento = {
  titulo: string;
  inicio: Date;
  fin: Date;
  notas?: string | null;
  /** null/undefined = evento único (no se repite). */
  recurrencia?: Recurrencia | null;
};

/**
 * Crea un evento en el calendario y devuelve su id (o null si falla).
 * Best-effort: nunca lanza (el espejo en calendario no debe romper el alta del objetivo).
 */
export async function crearEventoDragon(idCalendario: string, ev: NuevoEvento): Promise<string | null> {
  try {
    let recurrenceRule: Calendar.RecurrenceRule | undefined;
    if (ev.recurrencia) {
      const endDate = ev.recurrencia.hastaISO
        ? new Date(`${ev.recurrencia.hastaISO}T23:59:59`)
        : undefined;
      recurrenceRule =
        ev.recurrencia.frecuencia === 'DAILY'
          ? { frequency: Calendar.Frequency.DAILY, ...(endDate ? { endDate } : {}) }
          : {
              frequency: Calendar.Frequency.WEEKLY,
              daysOfTheWeek: [{ dayOfTheWeek: isoADiaExpo(ev.recurrencia.diaISO) as Calendar.DayOfTheWeek }],
              ...(endDate ? { endDate } : {}),
            };
    }

    const id = await Calendar.createEventAsync(idCalendario, {
      title: MARCA_DRAGON + ev.titulo, // prefijo 🐉 para distinguir y deduplicar
      startDate: ev.inicio,
      endDate: ev.fin,
      notes: ev.notas ?? undefined,
      ...(recurrenceRule ? { recurrenceRule } : {}),
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Borra evento(s) de la capa Dragón (best-effort). Acepta un id o varios separados por coma
 * (un objetivo con varios días guarda varios eventos).
 */
export async function borrarEventoDragon(idEvento: string): Promise<void> {
  for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await Calendar.deleteEventAsync(id);
    } catch {
      // el evento pudo haber sido borrado a mano; lo ignoramos
    }
  }
}

/**
 * Borra UNA ocurrencia puntual de un evento recurrente de la capa Dragón (best-effort).
 * `idEvento` puede traer varios ids (coma-separados): intenta en todos y solo el que tiene esa
 * ocurrencia la borra (los demás fallan y se ignoran). `instanceStartDate` = inicio EXACTO de la
 * ocurrencia (fecha + hora de inicio del objetivo ese día). ⚠️ Google NO permite "restaurar" una
 * ocurrencia borrada → para revertir hay que recrear el evento entero.
 */
export async function borrarOcurrenciaDragon(idEvento: string, instanceStartDate: Date): Promise<void> {
  for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await Calendar.deleteEventAsync(id, { instanceStartDate, futureEvents: false });
    } catch {
      // ese id no tiene esa ocurrencia (otro día) o ya no existe → ignoramos
    }
  }
}

/**
 * Mueve UNA ocurrencia de un evento recurrente del dispositivo a otro horario (solo ese día).
 * `instanceStartDate` = inicio ORIGINAL de la ocurrencia (fecha + hora normal). `idEvento` puede
 * traer varios ids (uno por día en SPECIFIC_DAYS): prueba en todos, solo el que tiene esa ocurrencia
 * la mueve. Best-effort. Devuelve true si alguno se actualizó.
 */
export async function actualizarOcurrenciaDragon(
  idEvento: string,
  instanceStartDate: Date,
  nuevoInicio: Date,
  nuevoFin: Date,
): Promise<boolean> {
  let ok = false;
  for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await Calendar.updateEventAsync(
        id,
        { startDate: nuevoInicio, endDate: nuevoFin },
        { instanceStartDate, futureEvents: false },
      );
      ok = true;
    } catch {
      // ese id no tiene esa ocurrencia → seguir
    }
  }
  return ok;
}

/**
 * Borra TODOS los eventos 🐉 del dispositivo cuyo título sea EXACTAMENTE "🐉 {nombre}" (con el
 * prefijo, para no tocar eventos propios de la usuaria con el mismo nombre). Sirve para limpiar
 * duplicados/huérfanos antes de re-espejar. Best-effort. Ventana amplia (-60 a +365 días).
 */
export async function borrarEventosDragonPorTitulo(nombre: string): Promise<void> {
  try {
    const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendarios.length === 0) return;
    const desde = new Date();
    desde.setDate(desde.getDate() - 60);
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + 365);
    const eventos = await Calendar.getEventsAsync(calendarios.map((c) => c.id), desde, hasta);
    const objetivo = MARCA_DRAGON + nombre;
    const ids = [...new Set(eventos.filter((e) => (e.title ?? '') === objetivo).map((e) => e.id))];
    for (const id of ids) {
      try {
        await Calendar.deleteEventAsync(id);
      } catch {
        // ya no existe / no se pudo → seguir
      }
    }
  } catch {
    // best-effort
  }
}

// ── Lectura del estado de un evento por id (para la doble vía calendario → app) ──

/** Estado actual de un evento espejo: si existe y con qué hora/día. Todo en la TZ del dispositivo. */
export type EstadoEvento = {
  existe: boolean;
  horaInicio: string | null; // 'HH:MM'
  horaFin: string | null; // 'HH:MM'
  diaISO: number | null; // 1=lunes … 7=domingo
};

function hhmmLocal(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function diaISOde(d: Date | null): number | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const g = d.getDay(); // 0=domingo … 6=sábado
  return g === 0 ? 7 : g;
}

/**
 * Lista las OCURRENCIAS (instancias) de los eventos 🐉 "{nombre}" del dispositivo en la ventana,
 * con su fecha y horario reales. Sirve para detectar cambios "solo un día" hechos en el calendario.
 * `null` = no se pudo leer. Best-effort.
 */
export async function instanciasDragonPorTitulo(
  nombre: string,
  desde: Date,
  hasta: Date,
): Promise<{ fecha: string; hi: string; hf: string }[] | null> {
  try {
    const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendarios.length === 0) return null;
    const eventos = await Calendar.getEventsAsync(calendarios.map((c) => c.id), desde, hasta);
    const objetivo = MARCA_DRAGON + nombre;
    const p = (n: number) => String(n).padStart(2, '0');
    const out: { fecha: string; hi: string; hf: string }[] = [];
    for (const e of eventos) {
      if ((e.title ?? '') !== objetivo) continue;
      const ini = e.startDate ? new Date(e.startDate) : null;
      const fin = e.endDate ? new Date(e.endDate) : null;
      const hi = hhmmLocal(ini);
      const hf = hhmmLocal(fin);
      if (!ini || !hi || !hf) continue;
      out.push({ fecha: `${ini.getFullYear()}-${p(ini.getMonth() + 1)}-${p(ini.getDate())}`, hi, hf });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Estado de un evento 🐉 del DISPOSITIVO por id. Devuelve:
 *  · `null` si NO se pudo determinar (error/transitorio) → el llamador NO debe concluir que se borró.
 *  · `{ existe, horaInicio, horaFin, diaISO }` si se pudo leer.
 * ⚠️ expo-calendar no distingue "borrado" de "error" cuando `getEventAsync` falla, así que ante
 * cualquier fallo devolvemos `null` (conservador: NO reflejamos bajas del calendario del teléfono
 * para evitar borrados falsos). Las bajas sí se reflejan cuando el espejo es de Google (404/410).
 */
export async function estadoEventoDragon(id: string): Promise<EstadoEvento | null> {
  try {
    const ev = await Calendar.getEventAsync(id);
    if (!ev) return null;
    const ini = ev.startDate ? new Date(ev.startDate) : null;
    const fin = ev.endDate ? new Date(ev.endDate) : null;
    return { existe: true, horaInicio: hhmmLocal(ini), horaFin: hhmmLocal(fin), diaISO: diaISOde(ini) };
  } catch {
    return null;
  }
}
