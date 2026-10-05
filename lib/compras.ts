// ÚNICO archivo que toca `react-native-purchases` (RevenueCat). El resto de la app
// habla con estas funciones, nunca con el SDK directo (misma convención que lib/health.ts
// y lib/calendario.ts).
//
// 🔒 La fuente de verdad del Premium sigue siendo el SERVIDOR (tabla `suscripcion`, RPC
// `es_premium`), que actualiza el WEBHOOK de RevenueCat. Estas funciones son para: mostrar
// los precios reales, disparar la compra, y dar feedback inmediato en la UI.
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

// Key PÚBLICA de RevenueCat (segura del lado del cliente, como la anon key). Se setea como
// EXPO_PUBLIC_REVENUECAT_ANDROID_KEY en eas.json cuando exista la cuenta de RevenueCat.
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const ENTITLEMENT = 'premium';
const OFFERING = 'default';

let configurado = false;

/** ¿Hay cobro real disponible? (Android + key presente). Si no, la app funciona igual sin cobro. */
export function comprasDisponibles(): boolean {
  return Platform.OS === 'android' && !!API_KEY_ANDROID;
}

/** Configura RevenueCat una sola vez (anónimo). Seguro de llamar siempre; no-op si falta la key. */
export function configurarCompras(): void {
  if (configurado || !comprasDisponibles()) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: API_KEY_ANDROID! });
    configurado = true;
  } catch {
    // Módulo nativo ausente (ej. Expo Go) → seguimos sin cobro real.
  }
}

/** Asocia las compras al usuario de Supabase (el webhook mapea por este id). */
export async function identificarUsuario(userId: string): Promise<void> {
  if (!comprasDisponibles()) return;
  configurarCompras();
  try {
    await Purchases.logIn(userId);
  } catch {
    /* best-effort */
  }
}

/** Desasocia al cerrar sesión (vuelve a un id anónimo). */
export async function cerrarSesionCompras(): Promise<void> {
  if (!configurado) return;
  try {
    await Purchases.logOut();
  } catch {
    /* best-effort */
  }
}

export type PaqueteCompra = {
  id: string;
  tipo: 'mensual' | 'anual' | 'otro';
  precio: string; // precio localizado, ej. "$4.999,00"
  pruebaGratis: boolean;
  raw: PurchasesPackage; // se lo pasás a comprarPaquete
};

function tipoDe(pkg: PurchasesPackage): PaqueteCompra['tipo'] {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'anual';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'mensual';
  return 'otro';
}

function tienePrueba(pkg: PurchasesPackage): boolean {
  const p = pkg.product as unknown as {
    introPrice?: unknown;
    defaultOption?: { freePhase?: unknown };
  };
  return p?.introPrice != null || p?.defaultOption?.freePhase != null;
}

/** Paquetes del offering `default` (anual primero). [] si no hay cobro configurado. */
export async function obtenerOfertas(): Promise<PaqueteCompra[]> {
  if (!comprasDisponibles()) return [];
  configurarCompras();
  try {
    const offerings = await Purchases.getOfferings();
    const off = offerings.all[OFFERING] ?? offerings.current;
    if (!off) return [];
    const items: PaqueteCompra[] = off.availablePackages.map((pkg) => ({
      id: pkg.identifier,
      tipo: tipoDe(pkg),
      precio: pkg.product.priceString,
      pruebaGratis: tienePrueba(pkg),
      raw: pkg,
    }));
    return items.sort((a, b) => (a.tipo === 'anual' ? -1 : b.tipo === 'anual' ? 1 : 0));
  } catch {
    return [];
  }
}

function activo(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT] != null;
}

/** Detecta si un error de compra fue una cancelación del usuario (no es un error real). */
export function fueCancelada(e: unknown): boolean {
  return typeof e === 'object' && e != null && (e as { userCancelled?: boolean }).userCancelled === true;
}

/** Dispara la compra. Devuelve true si quedó con Premium activo (según RevenueCat). Lanza si falla. */
export async function comprarPaquete(pkg: PurchasesPackage): Promise<boolean> {
  configurarCompras();
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return activo(customerInfo);
}

/** Restaura compras previas. true si tiene Premium. */
export async function restaurarCompras(): Promise<boolean> {
  if (!comprasDisponibles()) return false;
  configurarCompras();
  const info = await Purchases.restorePurchases();
  return activo(info);
}

/** Lee el Premium directo de RevenueCat (para desbloquear la UI al instante tras comprar). */
export async function premiumEnCliente(): Promise<boolean> {
  if (!comprasDisponibles()) return false;
  configurarCompras();
  try {
    return activo(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}
