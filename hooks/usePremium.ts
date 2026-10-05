import { useQuery } from '@tanstack/react-query';
import { premiumEnCliente } from '@/lib/compras';
import { supabase } from '@/lib/supabase';

/**
 * Estado Premium de la app. 🔒 La FUENTE DE VERDAD DURABLE es el servidor (tabla `suscripcion`,
 * RPC `es_premium`), que escribe el WEBHOOK de RevenueCat. Pero el webhook puede tardar unos
 * segundos tras la compra, así que ADEMÁS confiamos en la confirmación INSTANTÁNEA de RevenueCat
 * en el cliente (`premiumEnCliente`, entitlement validado por sus servidores) → el Premium se
 * activa al toque al pagar, sin "parpadeo", y el servidor se pone al día solo.
 * (Las operaciones que mueven monedas/dragones siguen validando `es_premium` server-side.)
 */
async function leerServidor(): Promise<boolean> {
  // rpc sin tipos generados todavía → cast.
  const { data, error } = await (supabase.rpc as any)('es_premium');
  if (error) return false;
  return data === true;
}

export async function leerPremium(): Promise<boolean> {
  const [servidor, cliente] = await Promise.all([leerServidor(), premiumEnCliente()]);
  return servidor || cliente;
}

/** ¿El usuario tiene Premium? (mientras carga, asume false). */
export function usePremium(): { esPremium: boolean; cargando: boolean } {
  const { data, isLoading } = useQuery({ queryKey: ['premium'], queryFn: leerPremium });
  return { esPremium: data ?? false, cargando: isLoading };
}
