// Capa de datos para el token de push (notificaciones del servidor). La UI/hook nunca toca
// Supabase directo: pasa por acá. Las RPCs nuevas todavía no están en los tipos generados → cast.
import { supabase } from '../supabase';

/** Guarda / actualiza el token de push de este dispositivo para el usuario actual. */
export async function registrarPushToken(token: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('registrar_push_token', { p_token: token });
  if (error) throw error;
}

/** Saca el token de push (al cerrar sesión, para no seguir mandándole push a este teléfono). */
export async function borrarPushToken(token: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('borrar_push_token', { p_token: token });
  if (error) throw error;
}
