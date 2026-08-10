import { supabase } from '../supabase';

/**
 * Devuelve el id del usuario logueado, o lanza si no hay sesión.
 * Se usa para setear `id_usuario` en los inserts (la RLS exige que
 * coincida con `auth.uid()`), así la UI nunca toca la sesión directo.
 */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No hay sesión activa.');
  return data.user.id;
}
