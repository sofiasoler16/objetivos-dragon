import { hoyISO } from '@/logic/fecha';
import {
  type ObjetivoPropuesto,
  type PropuestaIA,
  sanitizarPropuesta,
  type TareaPropuesta,
} from '@/logic/ia';
import { supabase } from '../supabase';
import { compromisosDeContexto, espejarEnCalendario } from './agenda';
import { listarCategorias } from './categorias';
import { actualizarObjetivo, crearObjetivo, type DiaHorario, type NuevoObjetivo } from './objetivos';
import { crearTarea, type NuevaTarea } from './tareas';

export type { ObjetivoPropuesto, PropuestaIA, TareaPropuesta } from '@/logic/ia';
import type { BloqueOcupado } from '@/logic/ia';

/** Resultado de organizar: la propuesta saneada + lo que ya tenías ocupado (para avisar solapes). */
export type ResultadoOrganizar = { propuesta: PropuestaIA; ocupado: BloqueOcupado[] };

/** Se llegó al límite mensual de la IA. La UI la muestra con el contador. */
export class LimiteIAError extends Error {
  usados: number;
  limite: number;
  constructor(usados: number, limite: number) {
    super(`Llegaste al límite de ${limite} usos de la IA este mes.`);
    this.name = 'LimiteIAError';
    this.usados = usados;
    this.limite = limite;
  }
}

/** Uso de la IA del mes en curso (para el contador "N/limite"). Best-effort: si falla, null. */
export async function usoIaActual(): Promise<{ usados: number; limite: number } | null> {
  try {
    // RPC nueva (aún no en los tipos generados) → cast.
    const { data, error } = await (supabase.rpc as any)('uso_ia_actual');
    if (error) return null;
    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila) return null;
    return { usados: Number(fila.usados ?? 0), limite: Number(fila.limite ?? 0) };
  } catch {
    return null;
  }
}

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
  // 🔒 Limited Use de Google: a la IA (Claude, servicio de terceros) SOLO le mandamos los
  // compromisos propios (objetivos/tareas de la app). Los eventos de Google Calendar/teléfono
  // (fuente 'externo') NUNCA se transfieren a la IA — se usan solo en el dispositivo para el
  // aviso de superposición (ver `ocupado` que devolvemos abajo, que sí los incluye).
  const compromisosParaIA = compromisos
    .filter((c) => c.fuente === 'app')
    .map(({ titulo, fecha, desde, hasta }) => ({ titulo, fecha, desde, hasta }));
  const { data, error } = await supabase.functions.invoke('organizar-semana', {
    body: {
      texto,
      hoy: hoyISO(),
      categorias: categorias.map((c) => ({ id: c.id_categoria, nombre: c.nombre })),
      compromisos: compromisosParaIA,
    },
  });
  if (error) throw error;
  // Límite mensual alcanzado (viene como 200 con marca desde la Edge Function).
  if (data && (data as { error?: string }).error === 'limite') {
    const d = data as { usados?: number; limite?: number };
    throw new LimiteIAError(Number(d.usados ?? 0), Number(d.limite ?? 0));
  }
  const ids = new Set(categorias.map((c) => c.id_categoria));
  return { propuesta: sanitizarPropuesta(data, ids), ocupado: compromisos };
}

/**
 * Crea en la base los objetivos/tareas que el usuario CONFIRMÓ de la propuesta.
 * Reusa la capa de datos normal (crearObjetivo/crearTarea). Los que tienen horario
 * (hora_inicio+hora_fin) además se ESPEJAN como evento en la capa "Drakostone"
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
    // Días con su horario (SPECIFIC_DAYS): cada día lleva la hora que le tocó (o null).
    let diasParam: (number | DiaHorario)[] | undefined;
    if (o.frecuencia_tipo === 'SPECIFIC_DAYS') {
      const porDia = new Map((o.horarios_dia ?? []).map((h) => [h.dia, h]));
      diasParam = (o.dias ?? []).map((d) => {
        const h = porDia.get(d);
        return { dia: d, hora_inicio: h?.hora_inicio ?? null, hora_fin: h?.hora_fin ?? null };
      });
    }
    const creado = await crearObjetivo(datos, diasParam);

    // Espejo al calendario según el horario.
    const base = datos.fecha_inicio ?? hoyISO();
    let idEvento: string | null = null;
    if (o.frecuencia_tipo === 'DAILY' && o.hora_inicio && o.hora_fin) {
      idEvento = await espejarEnCalendario({
        frecuencia: 'DAILY',
        titulo: o.nombre,
        baseISO: base,
        horaInicio: o.hora_inicio,
        horaFin: o.hora_fin,
        hastaISO: o.fecha_fin,
        colorId: creado.color ?? null,
      });
    } else if (o.frecuencia_tipo === 'SPECIFIC_DAYS' && (o.horarios_dia?.length ?? 0) > 0) {
      idEvento = await espejarEnCalendario({
        frecuencia: 'SPECIFIC_DAYS',
        titulo: o.nombre,
        baseISO: base,
        hastaISO: o.fecha_fin,
        colorId: creado.color ?? null,
        dias: o.horarios_dia!.map((h) => ({ dia: h.dia, horaInicio: h.hora_inicio, horaFin: h.hora_fin })),
      });
    }
    if (idEvento) await actualizarObjetivo(creado.id_objetivo, { id_evento_calendario: idEvento });
  }

  for (const t of tareas) {
    // Las tareas son solo vencimiento (fecha/hora límite): NO llevan bloque de horario ni evento.
    const datos: NuevaTarea = {
      titulo: t.titulo,
      descripcion: t.descripcion,
      prioridad: t.prioridad,
      id_categoria: t.id_categoria,
      fecha_limite: t.fecha_limite,
      hora_limite: t.hora_limite,
    };
    await crearTarea(datos);
  }
}
