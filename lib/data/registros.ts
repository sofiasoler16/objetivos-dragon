import { supabase } from '../supabase';
import type { Tables, TablesInsert } from '../types';

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

/** Marca (o desmarca) un objetivo BOOLEAN como completado en una fecha. */
export function marcarObjetivoCompletado(
  id_objetivo: string,
  fecha: string,
  completado = true,
): Promise<RegistroObjetivo> {
  return upsertRegistro({ id_objetivo, fecha, completado });
}

/** Guarda el valor de un objetivo NUMERIC (ej: 1500 de agua) en una fecha. */
export function registrarValor(
  id_objetivo: string,
  fecha: string,
  valor: number,
): Promise<RegistroObjetivo> {
  return upsertRegistro({ id_objetivo, fecha, valor });
}

/** Marca el objetivo como omitido ese día: queda fuera del cálculo del %. */
export function omitirObjetivo(
  id_objetivo: string,
  fecha: string,
  omitido = true,
): Promise<RegistroObjetivo> {
  return upsertRegistro({ id_objetivo, fecha, omitido });
}
