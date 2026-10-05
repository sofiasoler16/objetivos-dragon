// Puente de DICTADO POR VOZ (speech-to-text on-device) para la IA. NATIVO
// (expo-speech-recognition) → se ve recién en el rebuild. 🔒 Lazy require + try/catch: en el
// dev-client/bundle actual (sin el módulo nativo) NO rompe nada; simplemente `vozDisponible()`
// devuelve false y el botón de micrófono no se muestra.

type Subscripcion = { remove: () => void };
let subs: Subscripcion[] = [];

// Requerir el módulo nativo de forma perezosa (si no está en el build, devuelve null).
function modulo(): { ExpoSpeechRecognitionModule?: any } | null {
  try {
    return require('expo-speech-recognition');
  } catch {
    return null;
  }
}

function mod(): any | null {
  return modulo()?.ExpoSpeechRecognitionModule ?? null;
}

/** ¿Está el dictado por voz disponible en este build? (false en el dev-client actual). */
export function vozDisponible(): boolean {
  const m = mod();
  if (!m) return false;
  try {
    return m.isRecognitionAvailable?.() ?? true;
  } catch {
    return true; // el módulo existe; si el chequeo falla, dejamos intentar
  }
}

/** Pide permiso de micrófono/reconocimiento. Devuelve true si quedó concedido. */
export async function pedirPermisoVoz(): Promise<boolean> {
  const m = mod();
  if (!m) return false;
  try {
    const r = await m.requestPermissionsAsync();
    return !!r?.granted;
  } catch {
    return false;
  }
}

export type DictadoCallbacks = {
  onParcial?: (texto: string) => void; // texto reconocido mientras hablás (en vivo)
  onFinal?: (texto: string) => void; // texto final de la frase
  onFin?: () => void; // terminó de escuchar
  onError?: (motivo: string) => void; // 'sin-permiso' | 'no-disponible' | otro
};

/** Arranca a escuchar y transcribir. Devuelve true si se pudo iniciar. */
export async function iniciarDictado(cb: DictadoCallbacks): Promise<boolean> {
  const m = mod();
  if (!m) {
    cb.onError?.('no-disponible');
    return false;
  }
  const permiso = await pedirPermisoVoz();
  if (!permiso) {
    cb.onError?.('sin-permiso');
    return false;
  }
  try {
    detenerDictado(); // limpiar cualquier escucha previa
    subs.push(
      m.addListener('result', (e: { isFinal?: boolean; results?: { transcript?: string }[] }) => {
        const t = e?.results?.[0]?.transcript ?? '';
        if (e?.isFinal) cb.onFinal?.(t);
        else cb.onParcial?.(t);
      }),
    );
    subs.push(m.addListener('error', (e: { error?: string }) => cb.onError?.(String(e?.error ?? 'error'))));
    subs.push(m.addListener('end', () => cb.onFin?.()));
    m.start({ lang: 'es-AR', interimResults: true, continuous: false });
    return true;
  } catch {
    detenerDictado();
    cb.onError?.('error');
    return false;
  }
}

/** Detiene la escucha y libera los listeners (idempotente). */
export function detenerDictado(): void {
  try {
    mod()?.stop?.();
  } catch {
    /* ignorar */
  }
  for (const s of subs) {
    try {
      s.remove();
    } catch {
      /* ignorar */
    }
  }
  subs = [];
}
