import { supabase } from '../supabase';

/**
 * Congeladores de racha (automáticos). La lógica de CUÁNDO usarlos vive en el server
 * (`aplicar_congeladores`, SECURITY DEFINER). Acá solo se invoca y se leen los datos.
 * Casts a `any` mientras no se regeneren los tipos (columna/tabla nuevas).
 */

/** Aplica los congeladores que hagan falta (server). Devuelve cuántos se usaron AHORA. Best-effort. */
export async function aplicarCongeladores(): Promise<number> {
  const { data, error } = await (supabase.rpc as any)('aplicar_congeladores');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

/** Días protegidos por congeladores en un rango (ISO 'YYYY-MM-DD'), para el cálculo de la racha. */
export async function congeladasEnRango(desde: string, hasta: string): Promise<string[]> {
  const { data, error } = await (supabase.from('racha_congelada' as any) as any)
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) return [];
  return (data ?? []).map((r: { fecha: string }) => String(r.fecha).slice(0, 10));
}

/** Cantidad de congeladores disponibles del usuario (perfil.congeladores). */
export async function contarCongeladores(): Promise<number> {
  const { data } = await (supabase.from('perfil') as any).select('congeladores').maybeSingle();
  return (data as { congeladores?: number } | null)?.congeladores ?? 0;
}
