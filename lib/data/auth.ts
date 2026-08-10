import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

/**
 * Registro con email + contraseña. `nombre` viaja en user_metadata y el
 * trigger `handle_new_user` lo usa para crear el perfil + 4 categorías +
 * dragón inicial. Si el proyecto exige confirmar email, `session` viene null.
 */
export async function registrarse(params: {
  email: string;
  password: string;
  nombre?: string;
}) {
  const { email, password, nombre } = params;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre: nombre ?? '' } },
  });
  if (error) throw error;
  return data;
}

export async function iniciarSesion(params: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword(params);
  if (error) throw error;
  return data;
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obtenerSesion(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Se suscribe a cambios de sesión (login/logout/refresh). Devuelve un unsubscribe. */
export function onCambioSesion(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
