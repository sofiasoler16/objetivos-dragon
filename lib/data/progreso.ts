import { TZ_USUARIO } from '@/logic/fecha';
import type { DiaProgreso, ObjetivoProgreso } from '@/logic/progreso';
import { supabase } from '../supabase';

/** Fila de `detalle_dia`: estado de cada objetivo obligatorio de un día puntual. */
export type DetalleDia = {
  id_objetivo: string;
  nombre: string;
  tipo: 'BOOLEAN' | 'NUMERIC';
  meta_valor: number | null;
  unidad: string | null;
  valor: number | null;
  completado: boolean;
  omitido: boolean;
  credito: number;
};

/** Cumplimiento por día de un rango (calendario, barras L→D, resumen semanal). */
export async function progresoPorDia(
  desde: string,
  hasta: string,
  tz: string = TZ_USUARIO,
): Promise<DiaProgreso[]> {
  const { data, error } = await supabase.rpc('progreso_por_dia', {
    p_desde: desde,
    p_hasta: hasta,
    p_tz: tz,
  });
  if (error) throw error;
  return data ?? [];
}

/** Cumplimiento por objetivo en un rango (sección por categoría + desglose). */
export async function progresoPorObjetivo(
  desde: string,
  hasta: string,
  tz: string = TZ_USUARIO,
): Promise<ObjetivoProgreso[]> {
  const { data, error } = await supabase.rpc('progreso_por_objetivo', {
    p_desde: desde,
    p_hasta: hasta,
    p_tz: tz,
  });
  if (error) throw error;
  return data ?? [];
}

/** Detalle de un día puntual (al tocar una celda del calendario). */
export async function detalleDia(fecha: string): Promise<DetalleDia[]> {
  const { data, error } = await supabase.rpc('detalle_dia', { p_fecha: fecha });
  if (error) throw error;
  return data ?? [];
}
