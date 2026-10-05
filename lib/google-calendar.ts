// Puente a la API de Google Calendar (Fase B: color REAL por evento + editar horario).
// A diferencia de lib/calendario.ts (que lee/escribe el calendario del DISPOSITIVO con
// expo-calendar), este módulo habla DIRECTO con la API REST de Google Calendar v3, lo que
// permite setear el `colorId` (1..11) — algo que expo-calendar no expone.
//
// 🔑 La AUTENTICACIÓN ahora la maneja el SDK nativo de Google (lib/google-signin.ts): en Android
// se autentica por Google Play Services (package + SHA-1), sin redirect de navegador. Esto arregla
// el "Error 400: invalid_request" que daba el viejo flujo de expo-auth-session. Este archivo se
// queda SOLO con la escritura/lectura de eventos vía REST; el token sale de google-signin.
import {
  calendarioConectado,
  cerrarSesionGoogle,
  conectarCalendario,
  googleSigninDisponible,
  tokenAccesoCalendario,
  WEB_CLIENT_ID as _WEB_CLIENT_ID,
} from './google-signin';
import { MARCA_DRAGON, type EventoCalendario, type EstadoEvento } from '@/lib/calendario';
import { TZ_USUARIO } from '@/logic/fecha';

export const WEB_CLIENT_ID = _WEB_CLIENT_ID;

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** ¿Está disponible el login de Google (SDK nativo + webClientId)? (si no, la UI oculta la opción). */
export function googleConfigurado(): boolean {
  return googleSigninDisponible();
}

/** ¿Ya está conectado a Google Calendar (sesión con el scope calendar.events)? */
export async function googleConectado(): Promise<boolean> {
  return calendarioConectado();
}

/**
 * Conecta con Google Calendar (abre el selector nativo de cuentas + consentimiento). Devuelve true
 * si quedó conectado. Best-effort: nunca lanza (si el módulo nativo no está en el build, false).
 */
export async function conectarGoogleCalendar(): Promise<boolean> {
  return conectarCalendario();
}

/** Desconecta: revoca el acceso en Google y cierra la sesión nativa. */
export async function desconectarGoogle(): Promise<void> {
  await cerrarSesionGoogle(true);
}

/** Devuelve un access token válido para la API (renovado por el SDK), o null si no hay sesión. */
async function accessTokenValido(): Promise<string | null> {
  return tokenAccesoCalendario();
}

// ── Recurrencia → RRULE de Google ────────────────────────────────────────────
export type RecurrenciaGoogle =
  | { frecuencia: 'DAILY'; hastaISO?: string | null }
  | { frecuencia: 'WEEKLY'; diaISO: number; hastaISO?: string | null };

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']; // índice = ISO 1..7 - 1

function reglaRecurrencia(rec?: RecurrenciaGoogle | null): string | null {
  if (!rec) return null;
  const until = rec.hastaISO ? `;UNTIL=${rec.hastaISO.replace(/-/g, '')}T235959Z` : '';
  if (rec.frecuencia === 'DAILY') return `RRULE:FREQ=DAILY${until}`;
  const dia = BYDAY[(rec.diaISO - 1) % 7] ?? 'MO';
  return `RRULE:FREQ=WEEKLY;BYDAY=${dia}${until}`;
}

// Fecha LOCAL "naive" (sin Z) para mandarla junto con timeZone: la interpreta Google en esa TZ.
function naiveLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

// ── Escritura de eventos 🐉 vía la API (con colorId) ─────────────────────────
export type NuevoEventoGoogle = {
  titulo: string;
  inicio: Date; // hora local
  fin: Date;
  /** colorId de Google ('1'..'11'); null/undefined = color por defecto del calendario. */
  colorId?: string | null;
  notas?: string | null;
  /** null/undefined = evento único (no se repite). */
  recurrencia?: RecurrenciaGoogle | null;
};

/**
 * Crea un evento 🐉 en el calendario PRINCIPAL de Google del usuario. Devuelve su id (o null).
 * Best-effort: nunca lanza (si no hay sesión o falla la red, devuelve null y el alta sigue).
 */
export async function crearEventoGoogle(ev: NuevoEventoGoogle): Promise<string | null> {
  try {
    const token = await accessTokenValido();
    if (!token) return null;
    const body: Record<string, unknown> = {
      summary: MARCA_DRAGON + ev.titulo,
      start: { dateTime: naiveLocal(ev.inicio), timeZone: TZ_USUARIO },
      end: { dateTime: naiveLocal(ev.fin), timeZone: TZ_USUARIO },
    };
    if (ev.colorId) body.colorId = ev.colorId;
    if (ev.notas) body.description = ev.notas;
    const rrule = reglaRecurrencia(ev.recurrencia);
    if (rrule) body.recurrence = [rrule];

    const r = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id ?? null;
  } catch {
    return null;
  }
}

export type CambioEventoGoogle = {
  titulo?: string;
  inicio?: Date;
  fin?: Date;
  /** '1'..'11' o null para volver al color por defecto. undefined = no tocar el color. */
  colorId?: string | null;
};

/**
 * Edita un evento 🐉 existente (PATCH). En un evento recurrente cambia TODA la serie (el id es
 * el del evento maestro). `idEvento` puede traer varios ids coma-separados (uno por día en
 * SPECIFIC_DAYS): aplica el cambio a todos. Devuelve true si al menos uno se actualizó.
 */
export async function actualizarEventoGoogle(
  idEvento: string,
  cambios: CambioEventoGoogle,
): Promise<boolean> {
  try {
    const token = await accessTokenValido();
    if (!token) return false;
    const body: Record<string, unknown> = {};
    if (cambios.titulo != null) body.summary = MARCA_DRAGON + cambios.titulo;
    if (cambios.inicio) body.start = { dateTime: naiveLocal(cambios.inicio), timeZone: TZ_USUARIO };
    if (cambios.fin) body.end = { dateTime: naiveLocal(cambios.fin), timeZone: TZ_USUARIO };
    if (cambios.colorId !== undefined) body.colorId = cambios.colorId ?? null;
    if (Object.keys(body).length === 0) return false;

    let algunoOk = false;
    for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
      try {
        const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (r.ok) algunoOk = true;
      } catch {
        // ese id ya no existe → seguir con los demás
      }
    }
    return algunoOk;
  } catch {
    return false;
  }
}

/**
 * Borra evento(s) 🐉 (best-effort). Acepta un id o varios coma-separados (un objetivo con
 * varios días guarda varios eventos).
 */
export async function borrarEventoGoogle(idEvento: string): Promise<void> {
  const token = await accessTokenValido();
  if (!token) return;
  for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await fetch(`${API}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // el evento pudo haberse borrado a mano; ignorar
    }
  }
}

/**
 * Borra UNA ocurrencia de un evento recurrente 🐉 (best-effort). En Google, la instancia se
 * direcciona con `{idMaestro}_{inicioUTC}` (formato básico YYYYMMDDTHHMMSSZ). `idEvento` puede
 * traer varios ids coma-separados: intenta en todos y solo el que tiene esa ocurrencia la borra.
 * ⚠️ Google no permite "restaurar" una ocurrencia borrada → para revertir hay que recrear el evento.
 */
export async function borrarOcurrenciaGoogle(idEvento: string, inicioOcurrencia: Date): Promise<void> {
  const token = await accessTokenValido();
  if (!token) return;
  // inicio de la ocurrencia en UTC básico: 2026-08-24T19:00:00.000Z → 20260824T190000Z
  const basico = inicioOcurrencia.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      await fetch(`${API}/${encodeURIComponent(`${id}_${basico}`)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ese id no tiene esa ocurrencia (otro día) o ya no existe → ignorar
    }
  }
}

/**
 * Mueve UNA ocurrencia de un evento recurrente 🐉 de Google a otro horario (solo ese día), vía PATCH
 * de la instancia `{id}_{inicioOriginalUTC}`. `inicioOcurrencia` = inicio ORIGINAL (hora normal), que
 * es como Google identifica la instancia. `idEvento` puede traer varios ids: prueba en todos.
 * Best-effort. Devuelve true si alguno se actualizó.
 */
export async function actualizarOcurrenciaGoogle(
  idEvento: string,
  inicioOcurrencia: Date,
  nuevoInicio: Date,
  nuevoFin: Date,
): Promise<boolean> {
  const token = await accessTokenValido();
  if (!token) return false;
  const basico = inicioOcurrencia.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const body = {
    start: { dateTime: naiveLocal(nuevoInicio), timeZone: TZ_USUARIO },
    end: { dateTime: naiveLocal(nuevoFin), timeZone: TZ_USUARIO },
  };
  let ok = false;
  for (const id of idEvento.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const r = await fetch(`${API}/${encodeURIComponent(`${id}_${basico}`)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) ok = true;
    } catch {
      // esa instancia no está en este id → seguir
    }
  }
  return ok;
}

// ── Lectura de eventos de TODOS los calendarios de Google ────────────────────
const CAL_LIST = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

type EventoGoogle = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

/**
 * Lee los eventos de la semana de TODOS los calendarios de Google del usuario (no solo el
 * principal), normalizados igual que los del teléfono y EXCLUYENDO los 🐉 (nuestros objetivos, que
 * ya salen de la base → si no, se verían dos veces). Requiere el scope calendar.readonly.
 *
 * Devuelve:
 *   - un array (posiblemente vacío) si pudo leer de Google;
 *   - `null` si NO pudo (sin sesión / sin el scope aún / falla de red) → el llamador cae entonces
 *     a leer del teléfono, para no dejar la agenda vacía.
 * Best-effort: nunca lanza.
 */
export async function leerEventosGoogle(desde: Date, hasta: Date): Promise<EventoCalendario[] | null> {
  try {
    const token = await accessTokenValido();
    if (!token) return null;
    const auth = { Authorization: `Bearer ${token}` };

    const rl = await fetch(CAL_LIST, { headers: auth });
    if (!rl.ok) return null; // sin el scope de listado todavía → que el llamador use el teléfono
    const lj = (await rl.json()) as {
      items?: { id: string; backgroundColor?: string }[];
    };
    const cals = lj.items ?? [];

    const timeMin = desde.toISOString();
    const timeMax = hasta.toISOString();
    const salida: EventoCalendario[] = [];

    for (const cal of cals) {
      try {
        const url =
          `${CAL_BASE}/${encodeURIComponent(cal.id)}/events` +
          `?singleEvents=true&orderBy=startTime&maxResults=250` +
          `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
        const re = await fetch(url, { headers: auth });
        if (!re.ok) continue; // sin permiso de lectura en ESE calendario → seguir con los demás
        const ej = (await re.json()) as { items?: EventoGoogle[] };
        for (const ev of ej.items ?? []) {
          if (ev.status === 'cancelled') continue;
          const raw = ev.summary ?? '';
          if (raw.startsWith(MARCA_DRAGON)) continue; // nuestros 🐉 ya salen de la base
          const inicio = ev.start?.dateTime ?? ev.start?.date;
          const fin = ev.end?.dateTime ?? ev.end?.date;
          if (!inicio || !fin) continue;
          salida.push({
            id: ev.id ?? `${cal.id}:${inicio}`,
            titulo: raw.trim() || '(sin título)',
            inicio,
            fin,
            todoElDia: !ev.start?.dateTime, // los de todo el día vienen con `date`, no `dateTime`
            ubicacion: ev.location?.trim() || null,
            color: cal.backgroundColor ?? null,
            idCalendario: cal.id,
          });
        }
      } catch {
        // ese calendario falló → seguir con los demás
      }
    }
    return salida;
  } catch {
    return null;
  }
}

/**
 * Borra TODOS los eventos 🐉 de Google cuyo título sea EXACTAMENTE "🐉 {nombre}" (con prefijo, para
 * no tocar eventos propios de la usuaria). Busca los eventos MAESTROS (singleEvents=false) → borra la
 * serie completa. Sirve para limpiar duplicados/huérfanos antes de re-espejar. Best-effort.
 */
export async function borrarEventosGooglePorTitulo(nombre: string): Promise<void> {
  try {
    const token = await accessTokenValido();
    if (!token) return;
    const auth = { Authorization: `Bearer ${token}` };
    const objetivo = MARCA_DRAGON + nombre;

    // 🔒 NO usamos el buscador `q=`: el índice de búsqueda de Google tiene RETRASO y NO devuelve
    // los eventos recién creados → la limpieza no los encontraba y se acumulaban duplicados.
    // En su lugar LISTAMOS los eventos maestros (singleEvents=false) y filtramos por título EXACTO
    // en el cliente (la lista SÍ es consistente al instante). Paginado, con tope de seguridad.
    const ids: string[] = [];
    let pageToken: string | undefined;
    let paginas = 0;
    do {
      const url =
        `${API}?singleEvents=false&showDeleted=false&maxResults=250` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const r = await fetch(url, { headers: auth });
      if (!r.ok) return;
      const j = (await r.json()) as {
        items?: { id?: string; summary?: string }[];
        nextPageToken?: string;
      };
      for (const ev of j.items ?? []) {
        if ((ev.summary ?? '') === objetivo && ev.id) ids.push(ev.id);
      }
      pageToken = j.nextPageToken;
      paginas++;
    } while (pageToken && paginas < 40);

    for (const id of ids) {
      try {
        await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth });
      } catch {
        // ya no existe → seguir
      }
    }
  } catch {
    // best-effort
  }
}

// ── Estado de un evento de Google por id (para la doble vía calendario → app) ──
// 🔒 Google puede devolver el dateTime en UTC ("…T13:00:00Z") o con offset ("…T10:00:00-03:00").
// NO se puede sacar la hora con regex del string (agarraría "13" en el caso UTC → bug de +3h).
// Parseamos el instante y lo expresamos en la hora LOCAL del teléfono, igual que como se ESCRIBE
// el evento (naiveLocal usa la hora local) → round-trip correcto sin importar el formato.
function localDe(dt?: string | null): { fecha: string; hhmm: string } | null {
  if (!dt || !dt.includes('T')) return null; // sin hora (evento de todo el día) → sin horario
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hhmm: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}
function hhmmDe(dt?: string | null): string | null {
  return localDe(dt)?.hhmm ?? null;
}
function diaISODeFecha(s?: string | null): number | null {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T12:00:00` : s);
  if (Number.isNaN(d.getTime())) return null;
  const g = d.getDay();
  return g === 0 ? 7 : g;
}

/**
 * Lista las OCURRENCIAS (instancias) de los eventos 🐉 "{nombre}" de Google en la ventana, con su
 * fecha y horario reales (singleEvents=true expande la recurrencia y trae las excepciones movidas).
 * `null` = no se pudo leer. Best-effort.
 */
export async function instanciasGooglePorTitulo(
  nombre: string,
  desde: Date,
  hasta: Date,
): Promise<{ fecha: string; hi: string; hf: string }[] | null> {
  try {
    const token = await accessTokenValido();
    if (!token) return null;
    const objetivo = MARCA_DRAGON + nombre;
    const url =
      `${API}?q=${encodeURIComponent(objetivo)}&singleEvents=true&orderBy=startTime&maxResults=250` +
      `&timeMin=${encodeURIComponent(desde.toISOString())}&timeMax=${encodeURIComponent(hasta.toISOString())}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      items?: { summary?: string; status?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }[];
    };
    const out: { fecha: string; hi: string; hf: string }[] = [];
    for (const ev of j.items ?? []) {
      if ((ev.summary ?? '') !== objetivo || ev.status === 'cancelled') continue;
      const ini = localDe(ev.start?.dateTime); // fecha + hora LOCAL (evita el desfase de UTC)
      const hf = hhmmDe(ev.end?.dateTime);
      if (ini && hf) out.push({ fecha: ini.fecha, hi: ini.hhmm, hf });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Estado de un evento 🐉 de GOOGLE por id (sin el prefijo `g:`). Devuelve:
 *  · `null` si no se pudo determinar (sin sesión/scope, red) → el llamador NO concluye nada.
 *  · `{ existe:false }` si Google confirma que ya no está (404/410 o `cancelled`).
 *  · `{ existe:true, horaInicio, horaFin, diaISO }` con la hora/día actuales del evento.
 */
export async function estadoEventoGoogle(id: string): Promise<EstadoEvento | null> {
  try {
    const token = await accessTokenValido();
    if (!token) return null;
    const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404 || r.status === 410)
      return { existe: false, horaInicio: null, horaFin: null, diaISO: null };
    if (!r.ok) return null;
    const j = (await r.json()) as {
      status?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    };
    if (j.status === 'cancelled')
      return { existe: false, horaInicio: null, horaFin: null, diaISO: null };
    return {
      existe: true,
      horaInicio: hhmmDe(j.start?.dateTime),
      horaFin: hhmmDe(j.end?.dateTime),
      diaISO: diaISODeFecha(j.start?.dateTime ?? j.start?.date),
    };
  } catch {
    return null;
  }
}
