import { supabase } from '../supabase';
import type { Tables } from '../types';
import { requireUserId } from './_helpers';

export type Logro = Tables<'logro'>;

/** Un logro del catálogo + si el usuario lo tiene desbloqueado (y cuándo) + el dragón que regala. */
export type LogroConEstado = Logro & {
  desbloqueado: boolean;
  unlocked_at: string | null;
  dragon_nombre: string | null; // nombre del dragón que este logro entrega (o null)
};

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

/** Dragón que regala un logro (o null si ese logro no entrega ninguno). */
export type DragonDeLogro = { id_dragon: string; asset_key: string; nombre: string; id_tema: string | null };

export async function dragonDeLogroSeguro(idLogro: string): Promise<DragonDeLogro | null> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: DragonDeLogro[] | null; error: unknown }>
    )('dragon_de_logro', { p_id_logro: idLogro });
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

/** Clave (rule_type|target_value) para relacionar un logro con el dragón que habilita esa regla. */
function claveRegla(rule_type: string | null, target_value: number | null): string {
  return `${rule_type ?? ''}|${target_value ?? ''}`;
}

/** Mapa (rule_type|target_value) → nombre del dragón que esa regla entrega. Best-effort. */
async function mapaDragonesPorRegla(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  try {
    const anyDb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
      };
    };
    const [reglas, drags] = await Promise.all([
      anyDb.from('dragon_regla_desbloqueo').select('id_dragon, rule_type, target_value'),
      anyDb.from('dragon').select('id_dragon, nombre, activo'),
    ]);
    if (reglas.error || drags.error) return m;
    const nombrePorId = new Map<string, string>();
    for (const d of drags.data ?? []) if (d.activo) nombrePorId.set(String(d.id_dragon), String(d.nombre));
    for (const r of reglas.data ?? []) {
      const nom = nombrePorId.get(String(r.id_dragon));
      if (nom) m.set(claveRegla(r.rule_type as string | null, (r.target_value as number | null) ?? null), nom);
    }
  } catch {
    /* si no se puede leer el catálogo de dragones, no mostramos el dragón (best-effort) */
  }
  return m;
}

/** Catálogo de logros con el estado del usuario (para la pantalla de logros). */
export async function listarLogros(): Promise<LogroConEstado[]> {
  const uid = await requireUserId();
  const [cat, mios, dragMap] = await Promise.all([
    supabase.from('logro').select('*').eq('activo', true),
    supabase.from('usuario_logro').select('id_logro, unlocked_at').eq('id_usuario', uid),
    mapaDragonesPorRegla(),
  ]);
  if (cat.error) throw cat.error;
  if (mios.error) throw mios.error;

  const desbloqueado = new Map((mios.data ?? []).map((r) => [r.id_logro, r.unlocked_at]));
  const lista = (cat.data ?? []).map((l) => ({
    ...l,
    desbloqueado: desbloqueado.has(l.id_logro),
    unlocked_at: desbloqueado.get(l.id_logro) ?? null,
    dragon_nombre: dragMap.get(claveRegla(l.rule_type, l.target_value)) ?? null,
  }));
  // Desbloqueados primero; dentro de cada grupo, por recompensa de XP desc.
  lista.sort((a, b) =>
    a.desbloqueado === b.desbloqueado ? b.xp_reward - a.xp_reward : a.desbloqueado ? -1 : 1,
  );
  return lista;
}
