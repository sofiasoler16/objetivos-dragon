import { TZ_USUARIO } from '@/logic/fecha';
import type { EsperadoHoy } from '@/logic/hoy';
import { supabase } from '../supabase';

/** Objetivos WEEKLY_COUNT con lo hecho en la semana (RPC `semanales_hoy`). */
export type SemanalHoy = {
  id_objetivo: string;
  nombre: string;
  id_categoria: string | null;
  meta: number | null;
  hechos: number;
  completado_hoy: boolean;
};

/** Objetivos obligatorios de hoy (DAILY + SPECIFIC_DAYS de hoy) con su registro. */
export async function esperadosHoy(tz: string = TZ_USUARIO): Promise<EsperadoHoy[]> {
  const { data, error } = await supabase.rpc('esperados_hoy', { p_tz: tz });
  if (error) throw error;
  return data ?? [];
}

export async function semanalesHoy(tz: string = TZ_USUARIO): Promise<SemanalHoy[]> {
  const { data, error } = await supabase.rpc('semanales_hoy', { p_tz: tz });
  if (error) throw error;
  return data ?? [];
}
