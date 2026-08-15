import { hoyISO } from '@/logic/fecha';
import { primeraFechaOcurrencia } from '@/logic/agenda';
import {
  type ObjetivoPropuesto,
  type PropuestaIA,
  sanitizarPropuesta,
  type TareaPropuesta,
} from '@/logic/ia';
import { supabase } from '../supabase';
import { compromisosDeContexto, espejarEnCalendario } from './agenda';
import { listarCategorias } from './categorias';
import { actualizarObjetivo, crearObjetivo, type NuevoObjetivo } from './objetivos';
import { actualizarTarea, crearTarea, type NuevaTarea } from './tareas';

export type { ObjetivoPropuesto, PropuestaIA, TareaPropuesta } from '@/logic/ia';
import type { BloqueOcupado } from '@/logic/ia';

/** Resultado de organizar: la propuesta saneada + lo que ya tenías ocupado (para avisar solapes). */
export type ResultadoOrganizar = { propuesta: PropuestaIA; ocupado: BloqueOcupado[] };

/**
 * Llama a la Edge Function `organizar-semana` (que habla con Claude Haiku) y devuelve
 * una propuesta YA SANEADA + los bloques ocupados. La IA solo propone: no escribe nada.
 * Le pasamos el texto del usuario, la fecha de hoy, las categorías existentes (para que
 * elija de ellas, 🔒 sin inventar) y los COMPROMISOS ocupados (eventos + objetivos/tareas
 * con horario). El cliente además verifica solapamientos (la IA no es 100% confiable).
 */
export async function organizarSemana(texto: string): Promise<ResultadoOrganizar> {
  const [categorias, compromisos] = await Promise.all([
    listarCategorias(),
    compromisosDeContexto(21),
  ]);
  const { data, error } = await supabase.functions.invoke('organizar-semana', {
    body: {
      texto,
      hoy: hoyISO(),
      categorias: categorias.map((c) => ({ id: c.id_categoria, nombre: c.nombre })),
      compromisos,
    },
  });
  if (error) throw error;
  const ids = new Set(categorias.map((c) => c.id_categoria));
  return { propuesta: sanitizarPropuesta(data, ids), ocupado: compromisos };
}

/**
 * Crea en la base los objetivos/tareas que el usuario CONFIRMÓ de la propuesta.
 * Reusa la capa de datos normal (crearObjetivo/crearTarea). Los que tienen horario
 * (hora_inicio+hora_fin) además se ESPEJAN como evento en la capa "Objetivos Dragón"
 * y guardan su `id_evento_calendario` (best-effort: si el calendario falla, el objetivo
 * igual queda creado).
 */
export async function crearDesdePropuesta(
  objetivos: ObjetivoPropuesto[],
  tareas: TareaPropuesta[],
): Promise<void> {
  for (const o of objetivos) {
    const datos: NuevoObjetivo = {
      nombre: o.nombre,
      descripcion: o.descripcion,
      tipo: o.tipo,
      meta_valor: o.tipo === 'NUMERIC' ? o.meta_valor : null,
      unidad: o.tipo === 'NUMERIC' ? o.unidad : null,
      frecuencia_tipo: o.frecuencia_tipo,
      frecuencia_cantidad: o.frecuencia_tipo === 'WEEKLY_COUNT' ? o.frecuencia_cantidad : null,
      id_categoria: o.id_categoria,
      fecha_inicio: o.fecha_inicio ?? hoyISO(), // local, para que aparezca hoy
      fecha_fin: o.fecha_fin,
      hora_inicio: o.hora_inicio,
      hora_fin: o.hora_fin,
    };
    const dias = o.frecuencia_tipo === 'SPECIFIC_DAYS' ? (o.dias ?? []) : undefined;
    const creado = await crearObjetivo(datos, dias);

    // Espejo al calendario si tiene horario (y día concreto: DAILY o SPECIFIC_DAYS).
    if (o.hora_inicio && o.hora_fin && o.frecuencia_tipo !== 'WEEKLY_COUNT') {
      const base = datos.fecha_inicio ?? hoyISO();
      const diasRec = o.frecuencia_tipo === 'SPECIFIC_DAYS' ? (o.dias ?? []) : [1, 2, 3, 4, 5, 6, 7];
      const primera = primeraFechaOcurrencia(base, diasRec);
      const idEvento = await espejarEnCalendario({
        titulo: o.nombre,
        fechaISO: primera,
        horaInicio: o.hora_inicio,
        horaFin: o.hora_fin,
        diasRecurrentes: diasRec,
        hastaISO: o.fecha_fin,
      });
      if (idEvento) await actualizarObjetivo(creado.id_objetivo, { id_evento_calendario: idEvento });
    }
  }

  for (const t of tareas) {
    const datos: NuevaTarea = {
      titulo: t.titulo,
      descripcion: t.descripcion,
      prioridad: t.prioridad,
      id_categoria: t.id_categoria,
      fecha_limite: t.fecha_limite,
      hora_limite: t.hora_limite,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
    };
    const creada = await crearTarea(datos);

    // Espejo: tarea con bloque de horario en su fecha límite.
    if (t.hora_inicio && t.hora_fin && t.fecha_limite) {
      const idEvento = await espejarEnCalendario({
        titulo: t.titulo,
        fechaISO: t.fecha_limite,
        horaInicio: t.hora_inicio,
        horaFin: t.hora_fin,
      });
      if (idEvento) await actualizarTarea(creada.id_tarea, { id_evento_calendario: idEvento });
    }
  }
}
