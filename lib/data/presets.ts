import { hoyISO } from '@/logic/fecha';
import { type ClavePreset, type Preset, PRESETS, presetPorClave } from '@/logic/presets';
import { supabase } from '../supabase';
import { requireUserId } from './_helpers';
import {
  actualizarObjetivo,
  crearObjetivo,
  type NuevoObjetivo,
  type Objetivo,
  type ObjetivoConDias,
} from './objetivos';

export type { ClavePreset, Preset } from '@/logic/presets';

/** Estado de un preset para la sección "Sugeridos": catálogo + la fila real (si existe). */
export type PresetEstado = Preset & {
  /** id del objetivo si ya se creó alguna vez (aunque esté desactivado); si no, null. */
  id_objetivo: string | null;
  /** true si existe la fila y está activa (interruptor prendido). */
  activo: boolean;
  /** La fila real (con sus días), para leer la meta/frecuencia que editó el usuario. */
  objetivo: ObjetivoConDias | null;
};

/**
 * Estado de los 3 presets. Trae de la base los objetivos con `clave_preset`
 * (activos o no, con sus días) y los cruza con el catálogo. Los que nunca se
 * activaron salen con `id_objetivo: null`.
 */
export async function listarEstadoPresets(): Promise<PresetEstado[]> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('objetivo')
    .select('*, objetivo_dia(dia_semana)')
    .eq('id_usuario', id_usuario)
    .not('clave_preset', 'is', null);
  if (error) throw error;

  const porClave = new Map<string, ObjetivoConDias>();
  for (const fila of data ?? []) {
    const { objetivo_dia, ...objetivo } = fila;
    if (objetivo.clave_preset)
      porClave.set(objetivo.clave_preset, {
        ...objetivo,
        dias: objetivo_dia.map((d) => d.dia_semana).sort((a, b) => a - b),
      });
  }

  return PRESETS.map((p) => {
    const row = porClave.get(p.clave) ?? null;
    return { ...p, id_objetivo: row?.id_objetivo ?? null, activo: !!row?.activo, objetivo: row };
  });
}

/**
 * Prende un preset. Si ya existía la fila (aunque estuviera desactivada) la
 * reactiva conservando las ediciones; si no, crea el objetivo con los defaults
 * del catálogo (diario, NUMERIC, con la fuente de datos del preset).
 */
export async function activarPreset(clave: ClavePreset): Promise<Objetivo> {
  const id_usuario = await requireUserId();

  const { data: existente, error } = await supabase
    .from('objetivo')
    .select('id_objetivo')
    .eq('id_usuario', id_usuario)
    .eq('clave_preset', clave)
    .maybeSingle();
  if (error) throw error;

  if (existente) {
    return actualizarObjetivo(existente.id_objetivo, { activo: true });
  }

  const p = presetPorClave(clave);
  const datos: NuevoObjetivo = {
    nombre: p.nombre,
    tipo: 'NUMERIC',
    frecuencia_tipo: 'DAILY',
    meta_valor: p.meta_valor,
    unidad: p.unidad,
    fuente_datos: p.fuente_datos,
    fecha_inicio: hoyISO(), // local: si se activa de noche, igual aparece hoy
    clave_preset: p.clave,
  };
  return crearObjetivo(datos);
}

/** Apaga un preset: `activo=false`. Conserva la fila (y sus ediciones) para reactivarlo luego. */
export async function desactivarPreset(clave: ClavePreset): Promise<void> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('objetivo')
    .select('id_objetivo')
    .eq('id_usuario', id_usuario)
    .eq('clave_preset', clave)
    .maybeSingle();
  if (error) throw error;
  if (data) await actualizarObjetivo(data.id_objetivo, { activo: false });
}
