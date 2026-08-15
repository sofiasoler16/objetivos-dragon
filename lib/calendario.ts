// Puente ÚNICO al módulo nativo de calendario (como lib/health.ts / lib/notificaciones.ts).
// Lee el CALENDARIO DEL DISPOSITIVO (expo-calendar), que ya incluye los eventos de Google
// sincronizados por el SO. NO usa la API de Google Calendar (evita su verificación de OAuth).
// Además ESCRIBE los "objetivos con horario" como eventos en el calendario PRINCIPAL de Google
// del usuario (Android no deja crear una capa dedicada que sincronice; solo Google puede).
// Para distinguirlos, sus títulos llevan el prefijo MARCA "🐉 " (y así también se filtran al
// leer, para no duplicarlos con lo que ya sale de nuestra base).
import * as Calendar from 'expo-calendar';

/** Prefijo que marca los eventos creados por la app (para distinguir y deduplicar). */
export const MARCA_DRAGON = '🐉 ';

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
  opciones: { incluirDragon?: boolean } = {},
): Promise<EventoCalendario[]> {
  const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
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

// ── Escritura: capa "Objetivos Dragón" ─────────────────────────────────────

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

export type NuevoEvento = {
  titulo: string;
  inicio: Date;
  fin: Date;
  notas?: string | null;
  /** Días ISO para eventos recurrentes semanales (SPECIFIC_DAYS). Vacío/undefined = evento único. */
  diasRecurrentes?: number[];
  /** Fecha ISO (YYYY-MM-DD) hasta la que repetir (opcional). */
  hastaISO?: string | null;
};

/**
 * Crea un evento en la capa Dragón y devuelve su id (o null si falla).
 * Best-effort: nunca lanza (el espejo en calendario no debe romper el alta del objetivo).
 */
export async function crearEventoDragon(idCalendario: string, ev: NuevoEvento): Promise<string | null> {
  try {
    const recurrencia =
      ev.diasRecurrentes && ev.diasRecurrentes.length > 0
        ? {
            frequency: Calendar.Frequency.WEEKLY,
            daysOfTheWeek: ev.diasRecurrentes.map((d) => ({
              dayOfTheWeek: isoADiaExpo(d) as Calendar.DayOfTheWeek,
            })),
            ...(ev.hastaISO ? { endDate: new Date(`${ev.hastaISO}T23:59:59`) } : {}),
          }
        : undefined;

    const id = await Calendar.createEventAsync(idCalendario, {
      title: MARCA_DRAGON + ev.titulo, // prefijo 🐉 para distinguir y deduplicar
      startDate: ev.inicio,
      endDate: ev.fin,
      notes: ev.notas ?? undefined,
      ...(recurrencia ? { recurrenceRule: recurrencia } : {}),
    });
    return id;
  } catch {
    return null;
  }
}

/** Borra un evento de la capa Dragón (best-effort, no lanza). */
export async function borrarEventoDragon(idEvento: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(idEvento);
  } catch {
    // el evento pudo haber sido borrado a mano; lo ignoramos
  }
}
