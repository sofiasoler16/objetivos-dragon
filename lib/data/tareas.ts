import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../types';
import { requireUserId } from './_helpers';

export type Tarea = Tables<'tarea'>;
/** Al crear no se pasa `id_usuario`: lo inyecta la capa de datos desde la sesión. */
export type NuevaTarea = Omit<TablesInsert<'tarea'>, 'id_usuario'>;
export type CambiosTarea = TablesUpdate<'tarea'>;

export async function listarTareas(opciones?: {
  completadas?: boolean;
}): Promise<Tarea[]> {
  let query = supabase
    .from('tarea')
    .select('*')
    .order('fecha_limite', { ascending: true, nullsFirst: false });
  if (opciones?.completadas !== undefined) {
    query = query.eq('completada', opciones.completadas);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearTarea(datos: NuevaTarea): Promise<Tarea> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('tarea')
    .insert({ ...datos, id_usuario })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarTarea(
  id_tarea: string,
  cambios: CambiosTarea,
): Promise<Tarea> {
  const { data, error } = await supabase
    .from('tarea')
    .update(cambios)
    .eq('id_tarea', id_tarea)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Completar/descompletar: setea `fecha_completada` en consecuencia. */
export function completarTarea(id_tarea: string, completada = true): Promise<Tarea> {
  return actualizarTarea(id_tarea, {
    completada,
    fecha_completada: completada ? new Date().toISOString() : null,
  });
}

export async function eliminarTarea(id_tarea: string): Promise<void> {
  const { error } = await supabase.from('tarea').delete().eq('id_tarea', id_tarea);
  if (error) throw error;
}
