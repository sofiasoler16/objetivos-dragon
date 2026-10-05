import { supabase } from '../supabase';
import type { Tables, TablesInsert } from '../types';
import { recompensaSegura, revocacionSegura } from './recompensas';

export type RegistroObjetivo = Tables<'registro_objetivo'>;
/** Payload de upsert: exige `id_objetivo` y `fecha`; el resto es opcional. */
export type UpsertRegistro = TablesInsert<'registro_objetivo'>;

/**
 * Registros de un objetivo (lo que REALMENTE hizo). Es la fuente de verdad
 * de todo el progreso — nunca se calcula desde el estado del objetivo.
 * `fecha` en formato ISO 'YYYY-MM-DD' (día del usuario, no UTC).
 */
export async function listarRegistros(
  id_objetivo: string,
  rango?: { desde?: string; hasta?: string },
): Promise<RegistroObjetivo[]> {
  let query = supabase
    .from('registro_objetivo')
    .select('*')
    .eq('id_objetivo', id_objetivo)
    .order('fecha', { ascending: false });
  if (rango?.desde) query = query.gte('fecha', rango.desde);
  if (rango?.hasta) query = query.lte('fecha', rango.hasta);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Guarda (o quita) un horario EXCEPCIONAL para un objetivo en una fecha concreta (item 2.d).
 * Ej.: hoy hacés Coriza 15:30–18 en vez del 15–16 de siempre, sin cambiar la rutina.
 * `hora_inicio`/`hora_fin` = 'HH:MM' (o null/null para volver al horario normal del objetivo).
 * 🔒 Solo escribe la hora en el registro del día; NO toca completado/valor/omitido → no afecta el %.
 */
export async function setHorarioDia(
  id_objetivo: string,
  fecha: string,
  hora_inicio: string | null,
  hora_fin: string | null,
): Promise<void> {
  // `hora_inicio`/`hora_fin` son columnas nuevas (migración `agregar-horario-por-dia-registro.sql`),
  // aún no están en los tipos generados → cast puntual.
  const { error } = await (supabase.from('registro_objetivo') as any).upsert(
    { id_objetivo, fecha, hora_inicio, hora_fin },
    { onConflict: 'id_objetivo,fecha' },
  );
  if (error) throw error;
}

/** Todos los registros del usuario en un rango (para las grillas anuales por hábito). RLS → propios. */
export async function registrosEnRango(desde: string, hasta: string): Promise<RegistroObjetivo[]> {
  const { data, error } = await supabase
    .from('registro_objetivo')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw error;
  return data ?? [];
}

/**
 * Upsert por `(id_objetivo, fecha)` (constraint UNIQUE). Actualiza solo las
 * columnas presentes en el payload, así marcar `completado` no pisa `valor`.
 */
export async function upsertRegistro(registro: UpsertRegistro): Promise<RegistroObjetivo> {
  const { data, error } = await supabase
    .from('registro_objetivo')
    .upsert(
      { ...registro, fecha_actualizacion: new Date().toISOString() },
      { onConflict: 'id_objetivo,fecha' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Marca (o desmarca) un objetivo BOOLEAN como completado en una fecha. Otorga recompensa al completar. */
export async function marcarObjetivoCompletado(
  id_objetivo: string,
  fecha: string,
  completado = true,
): Promise<RegistroObjetivo> {
  const registro = await upsertRegistro({ id_objetivo, fecha, completado });
  if (completado) await recompensaSegura('objetivo', `obj:${id_objetivo}:${fecha}`);
  else await revocacionSegura(`obj:${id_objetivo}:${fecha}`); // desmarcó → devolver
  return registro;
}

/**
 * Suma `delta` al valor de HOY del objetivo (para metas semanales acumuladas: leer 30 min/semana).
 * NO marca `completado` ni da recompensa por día (la meta es semanal, no diaria). Piso en 0.
 */
export async function sumarValorHoy(
  id_objetivo: string,
  fecha: string,
  delta: number,
): Promise<RegistroObjetivo> {
  const { data } = await supabase
    .from('registro_objetivo')
    .select('valor')
    .eq('id_objetivo', id_objetivo)
    .eq('fecha', fecha)
    .maybeSingle();
  const nuevo = Math.max(0, (data?.valor ?? 0) + delta);
  return upsertRegistro({ id_objetivo, fecha, valor: nuevo });
}

/**
 * Suma `delta` al valor de un objetivo NUMERIC/DURATION diario y marca completado/recompensa si
 * llega a la meta (lee el valor actual y reusa `registrarValorNumerico`). Para el cronómetro.
 */
export async function sumarValorNumerico(
  id_objetivo: string,
  fecha: string,
  delta: number,
  meta: number | null,
): Promise<RegistroObjetivo> {
  const { data } = await supabase
    .from('registro_objetivo')
    .select('valor')
    .eq('id_objetivo', id_objetivo)
    .eq('fecha', fecha)
    .maybeSingle();
  return registrarValorNumerico(id_objetivo, fecha, (data?.valor ?? 0) + delta, meta);
}

/** Guarda el valor de un objetivo NUMERIC (ej: 1500 de agua) en una fecha. */
export function registrarValor(
  id_objetivo: string,
  fecha: string,
  valor: number,
): Promise<RegistroObjetivo> {
  return upsertRegistro({ id_objetivo, fecha, valor });
}

/**
 * Registra el valor de un numérico y marca `completado` si alcanzó la meta.
 * El valor real se guarda tal cual (puede pasar la meta) — el crédito del % ya
 * queda topeado en 1 en `logic/hoy.ts`. `valor` se piso en 0 (no negativo).
 */
export async function registrarValorNumerico(
  id_objetivo: string,
  fecha: string,
  valor: number,
  meta: number | null,
): Promise<RegistroObjetivo> {
  const v = Math.max(0, valor);
  const completado = meta != null && meta > 0 && v >= meta;
  const registro = await upsertRegistro({ id_objetivo, fecha, valor: v, completado });
  if (completado) await recompensaSegura('objetivo', `obj:${id_objetivo}:${fecha}`);
  else await revocacionSegura(`obj:${id_objetivo}:${fecha}`); // bajó de la meta → devolver
  return registro;
}

/**
 * Marca el objetivo como omitido ese día: queda fuera del cálculo del %.
 * `razon` (opcional) se guarda solo al omitir; al deshacer se limpia a NULL.
 */
export function omitirObjetivo(
  id_objetivo: string,
  fecha: string,
  omitido = true,
  razon?: string | null,
): Promise<RegistroObjetivo> {
  return upsertRegistro({
    id_objetivo,
    fecha,
    omitido,
    razon_omision: omitido ? (razon?.trim() || null) : null,
  });
}
