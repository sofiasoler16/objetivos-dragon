import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { cerrarSesionGoogle, googleSigninDisponible, iniciarSesionGoogle } from '../google-signin';
import { pushTokenEnMemoria } from '../notificaciones';
import { borrarPushToken } from './push';

/** ¿Se puede mostrar el botón "Entrar con Google"? (SDK nativo presente + webClientId). */
export function googleLoginDisponible(): boolean {
  return googleSigninDisponible();
}

/**
 * Login con Google: abre el selector de cuentas NATIVO, obtiene el idToken y lo canjea por una
 * sesión de Supabase (signInWithIdToken). El guard de rutas entra solo al haber sesión.
 * Requiere que en Supabase (Auth → Providers → Google) esté cargado el webClientId.
 */
export async function iniciarSesionConGoogle() {
  // iniciarSesionGoogle LANZA con el error real si la config falla (ej. DEVELOPER_ERROR);
  // devuelve null solo si el usuario canceló → en ese caso salimos sin mostrar error.
  const idToken = await iniciarSesionGoogle();
  if (!idToken) return null;
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

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
  // Sacar el token de push de este dispositivo (best-effort, ANTES del signOut mientras hay sesión)
  // para no seguir mandándole notificaciones a un teléfono deslogueado.
  try {
    const token = pushTokenEnMemoria();
    if (token) await borrarPushToken(token);
  } catch {
    /* si falla, el próximo login sobrescribe el token igual */
  }
  // Cerrar también la sesión de Google (best-effort, SIN revocar el permiso): así la próxima vez
  // que el usuario toque "Entrar con Google" puede ELEGIR otra cuenta, en vez de reentrar con la
  // misma automáticamente. No revocamos para no obligar a re-consentir todo de nuevo.
  try {
    await cerrarSesionGoogle(false);
  } catch {
    /* si el módulo nativo no está o falla, igual cerramos la sesión de Supabase */
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Elimina la cuenta del usuario actual y TODOS sus datos (borrado en cascada en la base).
 * Llama a la Edge Function `eliminar-cuenta` (service role) y cierra sesión. Requisito de Play.
 */
export async function eliminarCuenta(): Promise<void> {
  const { error } = await supabase.functions.invoke('eliminar-cuenta', { method: 'POST' });
  if (error) throw error;
  // La sesión ya no vale (el usuario fue borrado); limpiamos el estado local igual.
  try {
    await supabase.auth.signOut();
  } catch {
    /* la sesión ya está invalidada */
  }
}

/**
 * Paso 1 de "olvidé mi contraseña": envía al email un CÓDIGO de 6 dígitos para restablecerla.
 * ⚠️ Requiere que la plantilla "Reset Password" de Supabase incluya `{{ .Token }}` (el código),
 * no solo el link. Así el usuario mete el código en la app (no depende de abrir un link).
 */
export async function enviarCodigoRecuperacion(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

/**
 * Paso 2: verifica el código del email (type 'recovery') y setea la nueva contraseña. Al verificar,
 * el usuario queda con sesión → `updateUser` aplica la nueva contraseña y entra a la app.
 */
export async function restablecerPassword(params: {
  email: string;
  codigo: string;
  nuevaPassword: string;
}): Promise<void> {
  const { email, codigo, nuevaPassword } = params;
  const { error: e1 } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: codigo.trim(),
    type: 'recovery',
  });
  if (e1) throw e1;
  const { error: e2 } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (e2) throw e2;
}

/** Cambia la contraseña del usuario logueado (Perfil). Requiere sesión activa. */
export async function cambiarPassword(nuevaPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}

/** Datos básicos del usuario actual (para mostrar en Perfil). */
export async function datosUsuario(): Promise<{ email: string | null; nombre: string | null }> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  return {
    email: u?.email ?? null,
    nombre: (u?.user_metadata?.nombre as string | undefined)?.trim() || null,
  };
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
