import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../types';
import { requireUserId } from './_helpers';

export type Categoria = Tables<'categoria'>;
/** Al crear no se pasa `id_usuario`: lo inyecta la capa de datos desde la sesión. */
export type NuevaCategoria = Omit<TablesInsert<'categoria'>, 'id_usuario'>;
export type CambiosCategoria = TablesUpdate<'categoria'>;

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categoria')
    .select('*')
    .order('fecha_creacion', { ascending: true });
  if (error) throw error;
  return data;
}

export async function crearCategoria(datos: NuevaCategoria): Promise<Categoria> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('categoria')
    .insert({ ...datos, id_usuario })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCategoria(
  id_categoria: string,
  cambios: CambiosCategoria,
): Promise<Categoria> {
  const { data, error } = await supabase
    .from('categoria')
    .update(cambios)
    .eq('id_categoria', id_categoria)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCategoria(id_categoria: string): Promise<void> {
  const { error } = await supabase.from('categoria').delete().eq('id_categoria', id_categoria);
  if (error) throw error;
}
