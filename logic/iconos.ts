/**
 * Ícono de un objetivo — lógica pura, sin UI ni Supabase.
 *
 * Elige el emoji a mostrar con esta precedencia:
 *   1. Ícono ELEGIDO a mano por el usuario (`objetivo.icono`) — gana siempre.
 *   2. Heurística por nombre/unidad (agua 💧, pasos 👟, calorías 🍎).
 *   3. Ícono de la categoría.
 *   4. Genérico 🎯.
 *
 * El emoji detectado le gana a la categoría (un objetivo de agua muestra 💧 aunque
 * esté en "Salud" 🩺), pero si el usuario eligió un ícono a mano, ese manda.
 */

type ObjLike = { nombre?: string | null; unidad?: string | null; icono?: string | null };

/** Emoji sugerido según el nombre/unidad del objetivo, o null si no reconoce nada. */
export function iconoSugerido(obj: ObjLike): string | null {
  const texto = `${obj?.nombre ?? ''} ${obj?.unidad ?? ''}`.toLowerCase();
  if (/agua|water|hidrat|vaso/.test(texto)) return '💧';
  if (/paso|caminar|camino|step/.test(texto)) return '👟';
  if (/calor|kcal|comer|comida|nutric/.test(texto)) return '🍎';
  return null;
}

/** Ícono a mostrar: elegido a mano › heurística › categoría › genérico. */
export function iconoObjetivo(
  obj: ObjLike,
  iconoCategoria?: string | null,
  fallback = '🎯',
): string {
  const propio = obj?.icono?.trim();
  return (propio || null) ?? iconoSugerido(obj) ?? iconoCategoria ?? fallback;
}

/** Grilla curada de emojis para elegir el ícono de un objetivo. */
export const EMOJIS_OBJETIVO = [
  '🎯', '💧', '👟', '🏃', '🏋️', '🧘', '🚴', '🏊',
  '⚽', '🍎', '🥗', '🥦', '🍽️', '☕', '💊', '😴',
  '📚', '✍️', '🧠', '💻', '🎨', '🎵', '🎸', '🗣️',
  '🚿', '🦷', '🧹', '💰', '🐴', '🌱', '❤️', '⭐',
  '🔥', '📝', '🗓️', '🌞', '🚭', '🧴', '🐶', '🎮',
] as const;
