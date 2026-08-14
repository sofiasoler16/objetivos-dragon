import { hoyISO } from '@/logic/fecha';
import {
  type ComidaHC,
  healthConnectDisponible,
  leerCaloriasDeHoy,
  leerComidasDeHoy,
  leerPasosDeHoy,
  type MetricaHC,
  pedirPermiso,
  tienePermiso,
} from '../health';
import { supabase } from '../supabase';
import { requireUserId } from './_helpers';
import type { Objetivo } from './objetivos';
import { registrarValorNumerico } from './registros';

export type { ComidaHC, MetricaHC } from '../health';

export type MotivoSync = 'sin-objetivo' | 'no-disponible' | 'sin-permiso' | 'error';
export type ResultadoSyncHC = { ok: boolean; motivo?: MotivoSync; objetivos: number };

/**
 * Qué métrica de Health Connect trae un objetivo, derivada de la unidad:
 * unidad con "cal"/"kcal" → CALORIES; el resto (ej. "pasos") → STEPS.
 * (Evita agregar una columna a la base: la unidad ya distingue el dato.)
 */
export function metricaDeUnidad(unidad: string | null | undefined): MetricaHC {
  return unidad && /cal/i.test(unidad) ? 'CALORIES' : 'STEPS';
}

/** Objetivos activos marcados como fuente Health Connect (los que se autocompletan). */
export async function objetivosHealthConnect(): Promise<Objetivo[]> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('objetivo')
    .select('*')
    .eq('id_usuario', id_usuario)
    .eq('activo', true)
    .eq('fuente_datos', 'HEALTH_CONNECT');
  if (error) throw error;
  return data ?? [];
}

/**
 * Lee de Health Connect el valor de HOY (pasos o calorías, según la unidad) y lo
 * guarda (upsert en registro_objetivo) en cada objetivo con fuente HEALTH_CONNECT.
 * Best-effort: nunca lanza. En Supabase queda solo el valor decidido (ej. 1450 kcal).
 *  · interactivo=true  → dispara el diálogo de permiso si falta (botón "Actualizar").
 *  · interactivo=false → solo sincroniza lo que ya tenga permiso (auto al abrir Hoy).
 */
export async function sincronizarHealthConnect(interactivo = false): Promise<ResultadoSyncHC> {
  try {
    const objetivos = await objetivosHealthConnect();
    if (objetivos.length === 0) return { ok: false, motivo: 'sin-objetivo', objetivos: 0 };
    if (!(await healthConnectDisponible()))
      return { ok: false, motivo: 'no-disponible', objetivos: objetivos.length };

    const fecha = hoyISO();
    let algo = false;
    for (const o of objetivos) {
      const metrica = metricaDeUnidad(o.unidad);
      const permiso = interactivo ? await pedirPermiso(metrica) : await tienePermiso(metrica);
      if (!permiso) continue;
      const valor = metrica === 'CALORIES' ? await leerCaloriasDeHoy() : await leerPasosDeHoy();
      await registrarValorNumerico(o.id_objetivo, fecha, valor, o.meta_valor);
      algo = true;
    }
    if (!algo) return { ok: false, motivo: 'sin-permiso', objetivos: objetivos.length };
    return { ok: true, objetivos: objetivos.length };
  } catch {
    return { ok: false, motivo: 'error', objetivos: 0 };
  }
}

export type ResultadoComidas = { ok: boolean; motivo?: MotivoSync; comidas: ComidaHC[] };

/**
 * Comidas de HOY desde Health Connect (para el detalle del objetivo de calorías).
 *  · interactivo=true dispara el permiso de nutrición si falta.
 */
export async function comidasDeHoy(interactivo = false): Promise<ResultadoComidas> {
  try {
    if (!(await healthConnectDisponible())) return { ok: false, motivo: 'no-disponible', comidas: [] };
    const permiso = interactivo ? await pedirPermiso('CALORIES') : await tienePermiso('CALORIES');
    if (!permiso) return { ok: false, motivo: 'sin-permiso', comidas: [] };
    return { ok: true, comidas: await leerComidasDeHoy() };
  } catch {
    return { ok: false, motivo: 'error', comidas: [] };
  }
}
