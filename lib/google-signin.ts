// Puente ÚNICO al SDK NATIVO de Google (@react-native-google-signin/google-signin).
// Reemplaza el viejo flujo de navegador (expo-auth-session) que Google rechazaba en Android con
// "Error 400: invalid_request": los clientes OAuth de Android NO usan redirect por navegador, se
// autentican NATIVO vía Google Play Services (match por package + SHA-1). Esta librería hace eso.
//
// Sirve para DOS cosas con la misma cuenta:
//   1) Login de la app  → devuelve un idToken que Supabase valida (signInWithIdToken).
//   2) Google Calendar  → pide el scope calendar.events y da un accessToken para la API REST.
//
// 🔒 REGLA DEL PROYECTO: es un módulo NATIVO → NUNCA se importa estático (rompería el arranque del
// dev-client que no lo tenga). Se carga con lazy require() dentro de try/catch. Se ve en el rebuild.
//
// El webClientId (app.json → extra.googleCalendar.webClientId) es lo que define el `aud` del
// idToken → es el Client ID que hay que cargar en Supabase (Auth → Providers → Google). En Android
// la autenticación real la hace el cliente de Android por package+SHA-1 (no se pasa acá).
import Constants from 'expo-constants';

const cfg = ((Constants.expoConfig?.extra as Record<string, unknown> | undefined)
  ?.googleCalendar ?? {}) as { webClientId?: string };

export const WEB_CLIENT_ID = cfg.webClientId ?? '';
export const SCOPE_CALENDARIO = 'https://www.googleapis.com/auth/calendar.events';
// Para poder LISTAR todos los calendarios del usuario (y leer eventos de TODOS, no solo el
// principal) hace falta este scope de solo-lectura además del de eventos. Es el mismo permiso
// "sensible" (misma verificación de Google), así que no agrega trámite: solo hay que incluirlo
// en la pantalla de consentimiento.
export const SCOPE_CALENDARIO_LISTA = 'https://www.googleapis.com/auth/calendar.readonly';
const SCOPES_CALENDARIO = [SCOPE_CALENDARIO, SCOPE_CALENDARIO_LISTA];

/** Carga perezosa del módulo nativo. null si no está en el build actual (dev-client viejo). */
function cargarModulo(): { GoogleSignin: any; statusCodes?: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

/** ¿Está el SDK nativo disponible? (si no, la UI oculta los botones de Google). */
export function googleSigninDisponible(): boolean {
  return cargarModulo() !== null && !!WEB_CLIENT_ID;
}

// Configura el SDK con los scopes que necesita cada flujo. Es idempotente y barato: se llama al
// inicio de cada operación para que el login (scopes básicos) y el calendario (scope calendar) no
// se pisen. Devuelve el objeto GoogleSignin o null.
function configurar(conCalendario: boolean): any | null {
  const mod = cargarModulo();
  if (!mod || !WEB_CLIENT_ID) return null;
  try {
    mod.GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true, // pide serverAuthCode/refresh para renovar sin re-loguear
      scopes: conCalendario ? SCOPES_CALENDARIO : [],
    });
    return mod.GoogleSignin;
  } catch {
    return null;
  }
}

// El idToken puede venir como resp.data.idToken (SDK v13+) o resp.idToken (viejo). Normaliza.
function idTokenDe(resp: any): string | null {
  return resp?.data?.idToken ?? resp?.idToken ?? null;
}

/**
 * LOGIN con Google. Abre el selector de cuentas nativo y devuelve el idToken (para Supabase).
 * Devuelve null si el usuario cancela o el módulo no está. Best-effort: nunca lanza.
 */
export async function iniciarSesionGoogle(): Promise<string | null> {
  const mod = cargarModulo();
  const G = configurar(false);
  if (!G) return null;
  try {
    await G.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Forzar el SELECTOR de cuentas: sin esto, tras "cerrar sesión" el SDK reusa la última cuenta
    // recordada y no deja elegir otra. signOut() limpia esa cuenta → signIn() muestra el selector.
    try {
      await G.signOut();
    } catch {
      /* no había sesión previa → seguir */
    }
    const resp = await G.signIn();
    // SDK v13+: signIn devuelve { type: 'success' | 'cancelled', data }. Cancelar NO es error.
    if (resp?.type === 'cancelled') return null;
    const idToken = idTokenDe(resp);
    if (idToken) return idToken;
    // getTokens como plan B si signIn no trae el idToken en esta versión
    const t = await G.getTokens();
    return t?.idToken ?? null;
  } catch (e: any) {
    const codes = mod?.statusCodes ?? {};
    const code = e?.code;
    // Si el usuario canceló, no es un error → no mostramos nada.
    if (code === codes.SIGN_IN_CANCELLED || code === codes.IN_PROGRESS) return null;
    // Error REAL (config/servicios): lo hacemos VISIBLE para poder diagnosticar en producción
    // (el más común es DEVELOPER_ERROR = huella SHA-1 / paquete / clientId no coinciden).
    const partes = [code != null ? `código ${String(code)}` : null, e?.message].filter(Boolean);
    throw new Error(`Google no pudo iniciar sesión (${partes.join(' — ') || 'error desconocido'})`);
  }
}

/**
 * Conecta Google Calendar: pide (incrementalmente) el permiso de calendar.events.
 * Devuelve true si quedó autorizado. Best-effort: nunca lanza.
 */
export async function conectarCalendario(): Promise<boolean> {
  const G = configurar(true);
  if (!G) return false;
  try {
    await G.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Si ya hay sesión de Google, pedimos el scope de forma incremental; si no, login completo.
    const yaEntro = typeof G.hasPreviousSignIn === 'function' ? G.hasPreviousSignIn() : false;
    if (yaEntro && typeof G.addScopes === 'function') {
      const r = await G.addScopes({ scopes: SCOPES_CALENDARIO });
      // addScopes puede devolver null si el usuario ya lo tenía → igual está OK
      if (r === undefined) return false;
    } else {
      await G.signIn();
    }
    // Confirmamos que efectivamente tenemos un accessToken usable.
    const t = await G.getTokens();
    return !!t?.accessToken;
  } catch {
    return false;
  }
}

/**
 * Devuelve un accessToken válido para la API de Calendar (el SDK lo renueva solo), o null si no
 * hay sesión / no está conectado. Best-effort.
 */
export async function tokenAccesoCalendario(): Promise<string | null> {
  const G = configurar(true);
  if (!G) return null;
  try {
    const yaEntro = typeof G.hasPreviousSignIn === 'function' ? G.hasPreviousSignIn() : false;
    if (!yaEntro) return null;
    const t = await G.getTokens();
    return t?.accessToken ?? null;
  } catch {
    return null;
  }
}

/** ¿Ya está conectado a Google Calendar (sesión con el scope calendar.events)? */
export async function calendarioConectado(): Promise<boolean> {
  const G = configurar(true);
  if (!G) return false;
  try {
    const yaEntro = typeof G.hasPreviousSignIn === 'function' ? G.hasPreviousSignIn() : false;
    if (!yaEntro) return false;
    const u = typeof G.getCurrentUser === 'function' ? G.getCurrentUser() : null;
    const scopes: string[] = u?.scopes ?? u?.data?.scopes ?? [];
    // Si no podemos leer los scopes, caemos a "hay sesión" (mejor no bloquear la función).
    return scopes.length ? scopes.includes(SCOPE_CALENDARIO) : true;
  } catch {
    return false;
  }
}

/** Cierra la sesión de Google del dispositivo (login y/o calendario). Best-effort. */
export async function cerrarSesionGoogle(revocar: boolean): Promise<void> {
  const G = configurar(false);
  if (!G) return;
  try {
    if (revocar && typeof G.revokeAccess === 'function') {
      await G.revokeAccess();
    }
    if (typeof G.signOut === 'function') await G.signOut();
  } catch {
    // ignorar
  }
}
