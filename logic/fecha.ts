// "Hoy" y la hora se calculan SIEMPRE en la zona del usuario, no en UTC.
// OJO: Hermes (el motor de RN) NO soporta Intl.DateTimeFormat con timeZone,
// así que NO usamos Intl acá. Argentina es UTC−3 fijo (sin horario de verano),
// y da la misma fecha que Postgres con `now() at time zone p_tz`.
export const TZ_USUARIO = 'America/Argentina/Buenos_Aires';
const OFFSET_MINUTOS = -180; // UTC−3

/** `now` corrido al huso del usuario: leer sus métodos getUTC* da el reloj local. */
function ahoraLocal(): Date {
  return new Date(Date.now() + OFFSET_MINUTOS * 60_000);
}

/** Fecha de hoy en la zona del usuario, en formato ISO 'YYYY-MM-DD'. */
export function hoyISO(): string {
  return ahoraLocal().toISOString().slice(0, 10);
}

/** Hora actual (0..23) en la zona del usuario. */
export function horaActual(): number {
  return ahoraLocal().getUTCHours();
}

/** Suma `n` días a una fecha ISO 'YYYY-MM-DD' (aritmética en UTC, sin corrimientos). */
export function sumarDiasISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Día de la semana ISO (1=lunes … 7=domingo) de una fecha ISO. */
export function diaSemanaISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** Lunes (ISO) de la semana que contiene a `iso`. Semana = lunes (🔒). */
export function inicioSemanaISO(iso: string): string {
  return sumarDiasISO(iso, -(diaSemanaISO(iso) - 1));
}

/** Primer día del mes de `iso` ('YYYY-MM-01'). */
export function primerDiaMesISO(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

/** Último día del mes de `iso` (día 0 del mes siguiente). */
export function ultimoDiaMesISO(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Suma `n` meses al mes de `iso`, devolviendo su primer día. */
export function sumarMesesISO(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Nombre del mes en español de una fecha ISO. */
export function nombreMes(iso: string): string {
  return MESES[Number(iso.slice(5, 7)) - 1];
}

// --- Conversión con Date (para los selectores nativos). Todo en hora LOCAL del
// dispositivo (nunca vía UTC), así la fecha elegida es la que se guarda. ---

/** 'YYYY-MM-DD' → Date local (medianoche). null si vacío. */
export function isoADate(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD' (local). */
export function dateAISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** 'HH:MM[:SS]' → Date con esa hora (fecha de hoy). null si vacío. */
export function horaADate(hhmm?: string | null): Date | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Date → 'HH:MM' (local). */
export function dateAHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** '2026-08-15' → '15 de agosto de 2026' (para mostrar). */
export function fechaLarga(iso: string): string {
  const [y, , d] = iso.split('-').map(Number);
  return `${d} de ${nombreMes(iso).toLowerCase()} de ${y}`;
}
