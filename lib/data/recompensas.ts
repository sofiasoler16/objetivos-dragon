import { supabase } from '../supabase';

export type MotivoRecompensa = 'objetivo' | 'tarea_baja' | 'tarea_media' | 'tarea_alta';
export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA';

/** Motivo de recompensa según la prioridad de la tarea (más prioridad, más XP/monedas). */
export function motivoPorPrioridad(prioridad: Prioridad): MotivoRecompensa {
  return prioridad === 'ALTA' ? 'tarea_alta' : prioridad === 'BAJA' ? 'tarea_baja' : 'tarea_media';
}

// `supabase.rpc` está tipado contra las funciones generadas; estas se suman al
// regenerar tipos. Hasta entonces, wrapper puntual con cast.
async function rpc(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>
  )(fn, args);
  if (error) throw error;
}

/** Otorga XP+monedas por un evento (idempotente por `clave`). El servidor decide los montos. */
export function otorgarRecompensa(motivo: MotivoRecompensa, clave: string): Promise<void> {
  return rpc('otorgar_recompensa', { p_motivo: motivo, p_clave: clave });
}

/** Devuelve (borra) la recompensa de una clave. Se usa al DESMARCAR a mano. */
export function revocarRecompensa(clave: string): Promise<void> {
  return rpc('revocar_recompensa', { p_clave: clave });
}

/** Otorga best-effort: si falla (RPC ausente, sin red) NO rompe el flujo de completar. */
export async function recompensaSegura(motivo: MotivoRecompensa, clave: string): Promise<void> {
  try {
    await otorgarRecompensa(motivo, clave);
  } catch (e) {
    console.warn('No se pudo otorgar la recompensa:', e);
  }
}

/** Revoca best-effort: si falla, no rompe el flujo de desmarcar. */
export async function revocacionSegura(clave: string): Promise<void> {
  try {
    await revocarRecompensa(clave);
  } catch (e) {
    console.warn('No se pudo revocar la recompensa:', e);
  }
}
