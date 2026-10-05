// Control de "cuándo mostrar el paywall Premium solo" (promo de la prueba gratis).
// Regla (decisión de la usuaria 2026-09-09): al terminar el tutorial + cada 7 días si
// el usuario NO es Premium. Se recuerda en el teléfono la última vez que se mostró.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_ULTIMA = 'promo_premium_ultima_v1';
const DIAS_ENTRE_PROMOS = 7;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** ¿Corresponde mostrar la promo? (nunca se mostró, o pasaron ≥7 días). Best-effort. */
export async function debeMostrarPromo(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(CLAVE_ULTIMA);
    if (!v) return true; // nunca se mostró
    const ultima = Number(v);
    if (!Number.isFinite(ultima)) return true;
    return (Date.now() - ultima) / MS_POR_DIA >= DIAS_ENTRE_PROMOS;
  } catch {
    return false; // ante la duda, no molestar
  }
}

/** Registra que la promo se mostró recién (reinicia el contador de 7 días). */
export async function marcarPromoMostrada(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_ULTIMA, String(Date.now()));
  } catch {
    /* best-effort */
  }
}
