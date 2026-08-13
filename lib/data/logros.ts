import { supabase } from '../supabase';
import type { Tables } from '../types';
import { requireUserId } from './_helpers';

export type Logro = Tables<'logro'>;

/** Un logro del catálogo + si el usuario lo tiene desbloqueado (y cuándo). */
export type LogroConEstado = Logro & { desbloqueado: boolean; unlocked_at: string | null };

/** Fila devuelta por `evaluar_logros`: un logro recién desbloqueado (para celebrar). */
export type LogroDesbloqueado = {
  id_logro: string;
  nombre: string;
  descripcion: string | null;
  xp_reward: number;
  credit_reward: number;
};

// `supabase.rpc` está tipado contra las funciones generadas; `evaluar_logros` se
// suma al regenerar tipos. Hasta entonces, wrapper puntual con cast.
async function rpcLogros(): Promise<LogroDesbloqueado[]> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
    ) => Promise<{ data: LogroDesbloqueado[] | null; error: unknown }>
  )('evaluar_logros');
  if (error) throw error;
  return data ?? [];
}

/** Revisa el historial y desbloquea logros nuevos (idempotente). Devuelve los recién ganados. */
export function evaluarLogros(): Promise<LogroDesbloqueado[]> {
  return rpcLogros();
}

/** Best-effort: si falla (RPC ausente, sin red) NO rompe el flujo de completar. */
export async function evaluarLogrosSeguro(): Promise<LogroDesbloqueado[]> {
  try {
    return await evaluarLogros();
  } catch (e) {
    console.warn('No se pudieron evaluar los logros:', e);
    return [];
  }
}

/** Catálogo de logros con el estado del usuario (para la pantalla de logros). */
export async function listarLogros(): Promise<LogroConEstado[]> {
  const uid = await requireUserId();
  const [cat, mios] = await Promise.all([
    supabase.from('logro').select('*').eq('activo', true),
    supabase.from('usuario_logro').select('id_logro, unlocked_at').eq('id_usuario', uid),
  ]);
  if (cat.error) throw cat.error;
  if (mios.error) throw mios.error;

  const desbloqueado = new Map((mios.data ?? []).map((r) => [r.id_logro, r.unlocked_at]));
  const lista = (cat.data ?? []).map((l) => ({
    ...l,
    desbloqueado: desbloqueado.has(l.id_logro),
    unlocked_at: desbloqueado.get(l.id_logro) ?? null,
  }));
  // Desbloqueados primero; dentro de cada grupo, por recompensa de XP desc.
  lista.sort((a, b) =>
    a.desbloqueado === b.desbloqueado ? b.xp_reward - a.xp_reward : a.desbloqueado ? -1 : 1,
  );
  return lista;
}
