import { borrarEventoDragon } from '../calendario';
import { supabase } from '../supabase';
import type { Enums, Tables, TablesInsert, TablesUpdate } from '../types';
import { requireUserId } from './_helpers';

export type Objetivo = Tables<'objetivo'>;
/** Al crear no se pasa `id_usuario`: lo inyecta la capa de datos desde la sesión. */
export type NuevoObjetivo = Omit<TablesInsert<'objetivo'>, 'id_usuario'>;
export type CambiosObjetivo = TablesUpdate<'objetivo'>;
/** Un día de un objetivo SPECIFIC_DAYS con su horario opcional (hora por día). */
export type DiaHorario = { dia: number; hora_inicio?: string | null; hora_fin?: string | null };
/**
 * Objetivo con sus días ISO (1=lunes…7=domingo) y el horario de cada día resueltos desde
 * `objetivo_dia`. `dias` se mantiene para resúmenes; `horariosDia` trae la hora por día.
 */
export type ObjetivoConDias = Objetivo & {
  dias: number[];
  horariosDia: { dia: number; hora_inicio: string | null; hora_fin: string | null }[];
};

export async function listarObjetivos(opciones?: {
  soloActivos?: boolean;
}): Promise<Objetivo[]> {
  let query = supabase
    .from('objetivo')
    .select('*')
    .order('fecha_creacion', { ascending: false });
  if (opciones?.soloActivos) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Lista objetivos con sus días (ISO) resueltos en una sola consulta. */
export async function listarObjetivosConDias(opciones?: {
  soloActivos?: boolean;
}): Promise<ObjetivoConDias[]> {
  let query = supabase
    .from('objetivo')
    .select('*, objetivo_dia(dia_semana, hora_inicio, hora_fin)')
    .order('fecha_creacion', { ascending: false });
  if (opciones?.soloActivos) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((fila) => {
    const { objetivo_dia, ...objetivo } = fila;
    const orden = [...objetivo_dia].sort((a, b) => a.dia_semana - b.dia_semana);
    return {
      ...objetivo,
      dias: orden.map((d) => d.dia_semana),
      horariosDia: orden.map((d) => ({
        dia: d.dia_semana,
        hora_inicio: d.hora_inicio,
        hora_fin: d.hora_fin,
      })),
    };
  });
}

/** Días ISO (1=lunes…7=domingo) con su horario de un objetivo SPECIFIC_DAYS. */
export async function listarHorariosDia(
  id_objetivo: string,
): Promise<{ dia: number; hora_inicio: string | null; hora_fin: string | null }[]> {
  const { data, error } = await supabase
    .from('objetivo_dia')
    .select('dia_semana, hora_inicio, hora_fin')
    .eq('id_objetivo', id_objetivo)
    .order('dia_semana', { ascending: true });
  if (error) throw error;
  return data.map((f) => ({ dia: f.dia_semana, hora_inicio: f.hora_inicio, hora_fin: f.hora_fin }));
}

/** Días ISO (1=lunes…7=domingo) de un objetivo SPECIFIC_DAYS. */
export async function listarDiasObjetivo(id_objetivo: string): Promise<number[]> {
  return (await listarHorariosDia(id_objetivo)).map((h) => h.dia);
}

export async function obtenerObjetivo(id_objetivo: string): Promise<ObjetivoConDias | null> {
  const { data, error } = await supabase
    .from('objetivo')
    .select('*')
    .eq('id_objetivo', id_objetivo)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const horariosDia = await listarHorariosDia(id_objetivo);
  return { ...data, dias: horariosDia.map((h) => h.dia), horariosDia };
}

/**
 * Reemplaza el conjunto de días (SPECIFIC_DAYS) de un objetivo:
 * borra los actuales e inserta los nuevos. `dias` en ISO (1..7).
 */
/** Normaliza un día a `DiaHorario` (acepta número suelto o el objeto con horas). */
function aDiaHorario(d: number | DiaHorario): DiaHorario {
  return typeof d === 'number' ? { dia: d } : d;
}

export async function setDiasObjetivo(
  id_objetivo: string,
  dias: (number | DiaHorario)[],
): Promise<void> {
  const { error: errorBorrado } = await supabase
    .from('objetivo_dia')
    .delete()
    .eq('id_objetivo', id_objetivo);
  if (errorBorrado) throw errorBorrado;

  if (dias.length === 0) return;
  const filas: TablesInsert<'objetivo_dia'>[] = dias.map(aDiaHorario).map((d) => ({
    id_objetivo,
    dia_semana: d.dia,
    hora_inicio: d.hora_inicio ?? null,
    hora_fin: d.hora_fin ?? null,
  }));
  const { error } = await supabase.from('objetivo_dia').insert(filas);
  if (error) throw error;
}

/**
 * Crea un objetivo. Si es SPECIFIC_DAYS, pasá `dias` (ISO 1..7, o `DiaHorario` con hora por día)
 * y se guardan en `objetivo_dia`. Para WEEKLY_COUNT usar `frecuencia_cantidad` dentro de `datos`;
 * para NUMERIC, `meta_valor` + `unidad`. DAILY con hora usa `datos.hora_inicio/hora_fin`.
 */
export async function crearObjetivo(
  datos: NuevoObjetivo,
  dias?: (number | DiaHorario)[],
): Promise<Objetivo> {
  const id_usuario = await requireUserId();
  const { data, error } = await supabase
    .from('objetivo')
    .insert({ ...datos, id_usuario })
    .select()
    .single();
  if (error) throw error;

  if (datos.frecuencia_tipo === 'SPECIFIC_DAYS' && dias && dias.length > 0) {
    await setDiasObjetivo(data.id_objetivo, dias);
  }
  // Versión 1 de horario (Opción B): la config vigente desde el inicio. Solo DAILY/SPECIFIC_DAYS.
  if (datos.frecuencia_tipo === 'DAILY' || datos.frecuencia_tipo === 'SPECIFIC_DAYS') {
    const diasNums = (dias ?? []).map((d) => (typeof d === 'number' ? d : d.dia));
    await (supabase.from('objetivo_horario' as any) as any).insert({
      id_objetivo: data.id_objetivo,
      desde: datos.fecha_inicio ?? data.fecha_inicio,
      frecuencia_tipo: datos.frecuencia_tipo,
      dias: datos.frecuencia_tipo === 'SPECIFIC_DAYS' ? diasNums : null,
    });
  }
  return data;
}

/** Versiona el horario: 'historico' aplica el cambio a todo; 'desde_hoy' solo de hoy en adelante. */
export async function versionarHorario(
  id_objetivo: string,
  modo: 'historico' | 'desde_hoy',
  frecuencia: Enums<'frecuencia_tipo'>,
  dias: number[],
): Promise<void> {
  const fn = modo === 'historico' ? 'versionar_historico' : 'versionar_desde_hoy';
  const { error } = await (supabase.rpc as any)(fn, {
    p_objetivo: id_objetivo,
    p_frecuencia: frecuencia,
    p_dias: frecuencia === 'SPECIFIC_DAYS' ? dias : null,
  });
  if (error) throw error;
}

export async function actualizarObjetivo(
  id_objetivo: string,
  cambios: CambiosObjetivo,
): Promise<Objetivo> {
  const { data, error } = await supabase
    .from('objetivo')
    .update(cambios)
    .eq('id_objetivo', id_objetivo)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarObjetivo(id_objetivo: string): Promise<void> {
  // Si tenía evento espejo en el calendario, lo borramos también (best-effort).
  const { data } = await supabase
    .from('objetivo')
    .select('id_evento_calendario')
    .eq('id_objetivo', id_objetivo)
    .maybeSingle();
  // `objetivo_dia` y `registro_objetivo` caen por ON DELETE CASCADE.
  const { error } = await supabase.from('objetivo').delete().eq('id_objetivo', id_objetivo);
  if (error) throw error;
  if (data?.id_evento_calendario) await borrarEventoDragon(data.id_evento_calendario);
}
