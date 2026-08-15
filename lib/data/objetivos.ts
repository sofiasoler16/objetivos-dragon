import { borrarEventoDragon } from '../calendario';
import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../types';
import { requireUserId } from './_helpers';

export type Objetivo = Tables<'objetivo'>;
/** Al crear no se pasa `id_usuario`: lo inyecta la capa de datos desde la sesión. */
export type NuevoObjetivo = Omit<TablesInsert<'objetivo'>, 'id_usuario'>;
export type CambiosObjetivo = TablesUpdate<'objetivo'>;
/** Objetivo con sus días ISO (1=lunes…7=domingo) resueltos desde `objetivo_dia`. */
export type ObjetivoConDias = Objetivo & { dias: number[] };

export async function listarObjetivos(opciones?: {
  soloActivos?: boolean;
}): Promise<Objetivo[]> {
  let query = supabase
    .from('objetivo')
    .select('*')
    .order('fecha_creacion', { ascending: false });
  if (opciones?.soloActivos) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Lista objetivos con sus días (ISO) resueltos en una sola consulta. */
export async function listarObjetivosConDias(opciones?: {
  soloActivos?: boolean;
}): Promise<ObjetivoConDias[]> {
  let query = supabase
    .from('objetivo')
    .select('*, objetivo_dia(dia_semana)')
    .order('fecha_creacion', { ascending: false });
  if (opciones?.soloActivos) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((fila) => {
    const { objetivo_dia, ...objetivo } = fila;
    return {
      ...objetivo,
      dias: objetivo_dia.map((d) => d.dia_semana).sort((a, b) => a - b),
    };
  });
}

/** Días ISO (1=lunes…7=domingo) de un objetivo SPECIFIC_DAYS. */
export async function listarDiasObjetivo(id_objetivo: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('objetivo_dia')
    .select('dia_semana')
    .eq('id_objetivo', id_objetivo)
    .order('dia_semana', { ascending: true });
  if (error) throw error;
  return data.map((fila) => fila.dia_semana);
}

export async function obtenerObjetivo(id_objetivo: string): Promise<ObjetivoConDias | null> {
  const { data, error } = await supabase
    .from('objetivo')
    .select('*')
    .eq('id_objetivo', id_objetivo)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const dias = await listarDiasObjetivo(id_objetivo);
  return { ...data, dias };
}

/**
 * Reemplaza el conjunto de días (SPECIFIC_DAYS) de un objetivo:
 * borra los actuales e inserta los nuevos. `dias` en ISO (1..7).
 */
export async function setDiasObjetivo(id_objetivo: string, dias: number[]): Promise<void> {
  const { error: errorBorrado } = await supabase
    .from('objetivo_dia')
    .delete()
    .eq('id_objetivo', id_objetivo);
  if (errorBorrado) throw errorBorrado;

  if (dias.length === 0) return;
  const filas: TablesInsert<'objetivo_dia'>[] = dias.map((dia_semana) => ({
    id_objetivo,
    dia_semana,
  }));
  const { error } = await supabase.from('objetivo_dia').insert(filas);
  if (error) throw error;
}

/**
 * Crea un objetivo. Si es SPECIFIC_DAYS, pasá `dias` (ISO 1..7) y se
 * guardan en `objetivo_dia`. Para WEEKLY_COUNT usar `frecuencia_cantidad`
 * dentro de `datos`; para NUMERIC, `meta_valor` + `unidad`.
 */
export async function crearObjetivo(
  datos: NuevoObjetivo,
  dias?: number[],
): Promise<Objetivo> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('objetivo')
    .insert({ ...datos, id_usuario })
    .select()
    .single();
  if (error) throw error;

  if (datos.frecuencia_tipo === 'SPECIFIC_DAYS' && dias && dias.length > 0) {
    await setDiasObjetivo(data.id_objetivo, dias);
  }
  return data;
}

export async function actualizarObjetivo(
  id_objetivo: string,
  cambios: CambiosObjetivo,
): Promise<Objetivo> {
  const { data, error } = await supabase
    .from('objetivo')
    .update(cambios)
    .eq('id_objetivo', id_objetivo)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarObjetivo(id_objetivo: string): Promise<void> {
  // Si tenía evento espejo en el calendario, lo borramos también (best-effort).
  const { data } = await supabase
    .from('objetivo')
    .select('id_evento_calendario')
    .eq('id_objetivo', id_objetivo)
    .maybeSingle();
  // `objetivo_dia` y `registro_objetivo` caen por ON DELETE CASCADE.
  const { error } = await supabase.from('objetivo').delete().eq('id_objetivo', id_objetivo);
  if (error) throw error;
  if (data?.id_evento_calendario) await borrarEventoDragon(data.id_evento_calendario);
}
