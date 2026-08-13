import { supabase } from '../supabase';
import type { Tables } from '../types';
import { requireUserId } from './_helpers';

export type Tema = Tables<'tema'>;
export type DragonRow = Tables<'dragon'>;
export type ReglaDesbloqueo = Tables<'dragon_regla_desbloqueo'>;

/** Stats del perfil (caché derivable de los movimientos). */
export type PerfilStats = { nivel: number; xp_total: number; creditos: number };

/** Un dragón del catálogo con su tema, su regla y si el usuario lo tiene/equipa. */
export type DragonColeccion = DragonRow & {
  tema: Tema | null;
  regla: ReglaDesbloqueo | null;
  adquirido: boolean;
  equipado: boolean;
};

/**
 * Carga todo lo necesario para la pantalla "Mi Dragón" en paralelo, y arma el
 * catálogo con el estado de cada dragón (adquirido/equipado). Lecturas separadas
 * (no embebidas) para tipado limpio; se unen por id en el cliente.
 */
export async function cargarColeccion(): Promise<{
  stats: PerfilStats;
  dragones: DragonColeccion[];
  logrosDesbloqueados: string[];
}> {
  const uid = await requireUserId();
  const [perfil, dragones, temas, reglas, mis, pref, logros] = await Promise.all([
    supabase.from('perfil').select('nivel, xp_total, creditos').eq('id_usuario', uid).single(),
    supabase.from('dragon').select('*').eq('activo', true).order('orden', { nullsFirst: false }),
    supabase.from('tema').select('*'),
    supabase.from('dragon_regla_desbloqueo').select('*'),
    supabase.from('usuario_dragon').select('id_dragon').eq('id_usuario', uid),
    supabase.from('preferencia_usuario').select('id_dragon_seleccionado').eq('id_usuario', uid).maybeSingle(),
    supabase.from('usuario_logro').select('logro:id_logro(rule_type)').eq('id_usuario', uid),
  ]);

  for (const r of [perfil, dragones, temas, reglas, mis, pref, logros]) {
    if (r.error) throw r.error;
  }

  const temaPorId = new Map((temas.data ?? []).map((t) => [t.id_tema, t]));
  const reglaPorDragon = new Map((reglas.data ?? []).map((r) => [r.id_dragon, r]));
  const adquiridos = new Set((mis.data ?? []).map((r) => r.id_dragon));
  const equipadoId = pref.data?.id_dragon_seleccionado ?? null;

  // rule_types de los logros que el usuario ya desbloqueó (habilitan dragones de historial).
  const logrosDesbloqueados = (logros.data ?? [])
    .map((r) => {
      const l = r.logro as { rule_type: string } | { rule_type: string }[] | null;
      return Array.isArray(l) ? l[0]?.rule_type : l?.rule_type;
    })
    .filter((x): x is string => !!x);

  const lista: DragonColeccion[] = (dragones.data ?? []).map((d) => ({
    ...d,
    tema: d.id_tema ? (temaPorId.get(d.id_tema) ?? null) : null,
    regla: reglaPorDragon.get(d.id_dragon) ?? null,
    adquirido: adquiridos.has(d.id_dragon),
    equipado: d.id_dragon === equipadoId,
  }));

  const stats: PerfilStats = perfil.data ?? { nivel: 1, xp_total: 0, creditos: 0 };
  return { stats, dragones: lista, logrosDesbloqueados };
}

/** Tema del dragón equipado (para pintar la app). null si no hay sesión/preferencia. */
export async function temaActivo(): Promise<Tema | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('preferencia_usuario')
    .select('tema:id_tema_seleccionado(*)')
    .eq('id_usuario', user.id)
    .maybeSingle();
  if (error) return null;
  const t = data?.tema as Tema | Tema[] | null | undefined;
  return Array.isArray(t) ? (t[0] ?? null) : (t ?? null);
}

/** Stats del perfil (nivel/XP/monedas) para la barra superior. */
export async function obtenerPerfilStats(): Promise<PerfilStats> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('perfil')
    .select('nivel, xp_total, creditos')
    .eq('id_usuario', uid)
    .single();
  if (error) throw error;
  return data ?? { nivel: 1, xp_total: 0, creditos: 0 };
}

/** Compra un dragón (RPC segura: valida requisito/monedas y descuenta del lado del servidor). */
export async function comprarDragon(idDragon: string): Promise<void> {
  const { error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message?: string } | null }>
  )('comprar_dragon', { p_id_dragon: idDragon });
  if (error) throw new Error(error.message ?? 'No se pudo comprar el dragón.');
}

/** Equipa un dragón: guarda su preferencia (dragón + su tema). Solo para dragones adquiridos. */
export async function equiparDragon(idDragon: string, idTema: string | null): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase
    .from('preferencia_usuario')
    .upsert(
      { id_usuario: uid, id_dragon_seleccionado: idDragon, id_tema_seleccionado: idTema },
      { onConflict: 'id_usuario' },
    );
  if (error) throw error;
}

/** asset_key del dragón equipado (para el botón de la barra superior). Cae al Original. */
export async function assetKeyEquipado(): Promise<string> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('preferencia_usuario')
    .select('dragon:id_dragon_seleccionado(asset_key)')
    .eq('id_usuario', uid)
    .maybeSingle();
  if (error) throw error;
  const rel = data?.dragon as { asset_key: string } | { asset_key: string }[] | null | undefined;
  const asset = Array.isArray(rel) ? rel[0]?.asset_key : rel?.asset_key;
  return asset ?? 'dragon_original';
}
