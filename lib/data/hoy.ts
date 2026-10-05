import { TZ_USUARIO } from '@/logic/fecha';
import type { EsperadoHoy } from '@/logic/hoy';
import { supabase } from '../supabase';

/**
 * Objetivos WEEKLY_COUNT con lo hecho en la semana (RPC `semanales_hoy`).
 * BOOLEAN = veces (meta=frecuencia_cantidad, hechos=cuántas veces). NUMERIC/DURATION = valor
 * acumulado (meta=meta semanal, hechos=suma del valor de la semana).
 */
export type SemanalHoy = {
  id_objetivo: string;
  nombre: string;
  id_categoria: string | null;
  tipo: 'BOOLEAN' | 'NUMERIC' | 'DURATION';
  unidad: string | null;
  meta: number | null;
  hechos: number;
  completado_hoy: boolean;
};

/**
 * Objetivos obligatorios de un día (DAILY + SPECIFIC_DAYS que caen ese día) con su registro.
 * `fecha` (ISO 'YYYY-MM-DD') opcional: si no viene, usa hoy en la TZ del usuario (server-side).
 */
export async function esperadosHoy(tz: string = TZ_USUARIO, fecha?: string): Promise<EsperadoHoy[]> {
  const { data, error } = await supabase.rpc('esperados_hoy', { p_tz: tz, p_fecha: fecha ?? undefined });
  if (error) throw error;
  return data ?? [];
}

export async function semanalesHoy(tz: string = TZ_USUARIO, fecha?: string): Promise<SemanalHoy[]> {
  const { data, error } = await supabase.rpc('semanales_hoy', { p_tz: tz, p_fecha: fecha ?? undefined });
  if (error) throw error;
  return data ?? [];
}
