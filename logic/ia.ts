/**
 * Propuesta de la IA para "Organizá mi semana" — tipos + saneamiento puro.
 *
 * 🔒 La IA PROPONE, el código EJECUTA. Nunca confiamos ciegamente en el JSON de la IA:
 * `sanitizarPropuesta` descarta/corrige lo que no calce con el schema real (enums,
 * frecuencias coherentes, categorías que existan, fechas válidas). Es la última barrera
 * antes de crear objetivos/tareas.
 */

import { diaSemanaISO, sumarDiasISO } from './fecha';

export type TipoObjetivo = 'BOOLEAN' | 'NUMERIC';
export type FrecuenciaTipo = 'DAILY' | 'SPECIFIC_DAYS' | 'WEEKLY_COUNT';
export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA';

/** Horario de un día puntual (para SPECIFIC_DAYS: cada día puede caer a distinta hora). */
export type HorarioDia = { dia: number; hora_inicio: string; hora_fin: string };

export type ObjetivoPropuesto = {
  nombre: string;
  descripcion: string | null;
  tipo: TipoObjetivo;
  meta_valor: number | null;
  unidad: string | null;
  frecuencia_tipo: FrecuenciaTipo;
  dias: number[] | null; // ISO 1..7 (solo SPECIFIC_DAYS)
  frecuencia_cantidad: number | null; // solo WEEKLY_COUNT
  id_categoria: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  // "Con horario" (se agenda como evento). DAILY usa hora_inicio/hora_fin (una sola).
  // SPECIFIC_DAYS usa horarios_dia (una hora por día). Null → objetivo del día sin evento.
  hora_inicio: string | null; // HH:MM (DAILY)
  hora_fin: string | null; // HH:MM (DAILY)
  horarios_dia: HorarioDia[] | null; // SPECIFIC_DAYS
};

export type TareaPropuesta = {
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad;
  id_categoria: string | null;
  fecha_limite: string | null;
  hora_limite: string | null; // solo vencimiento (deadline). Las tareas NO llevan bloque de horario.
};

export type PropuestaIA = {
  mensaje: string;
  objetivos: ObjetivoPropuesto[];
  tareas: TareaPropuesta[];
};

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ES_HORA = /^\d{2}:\d{2}(:\d{2})?$/;

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function fecha(v: unknown): string | null {
  return typeof v === 'string' && ES_FECHA.test(v) ? v : null;
}
function hora(v: unknown): string | null {
  return typeof v === 'string' && ES_HORA.test(v) ? v.slice(0, 5) : null;
}
function numeroPos(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function unoDe<T extends string>(v: unknown, opciones: readonly T[]): T | null {
  return typeof v === 'string' && (opciones as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * Bloque de horario coherente: exige inicio Y fin válidos con fin > inicio.
 * Si falta uno o no cierran, devuelve ambos en null (→ objetivo/tarea "normal", sin evento).
 */
function bloque(rawInicio: unknown, rawFin: unknown): { inicio: string | null; fin: string | null } {
  const inicio = hora(rawInicio);
  const fin = hora(rawFin);
  if (!inicio || !fin || fin <= inicio) return { inicio: null, fin: null };
  return { inicio, fin };
}

function saneaObjetivo(raw: any, categoriaIds: Set<string>): ObjetivoPropuesto | null {
  const nombre = texto(raw?.nombre);
  if (!nombre) return null; // sin nombre no hay objetivo

  let tipo = unoDe<TipoObjetivo>(raw?.tipo, ['BOOLEAN', 'NUMERIC']) ?? 'BOOLEAN';
  const meta = numeroPos(raw?.meta_valor);
  // NUMERIC exige meta; si no vino, cae a BOOLEAN (respeta chk_numeric_meta).
  if (tipo === 'NUMERIC' && meta == null) tipo = 'BOOLEAN';

  let frecuencia = unoDe<FrecuenciaTipo>(raw?.frecuencia_tipo, ['DAILY', 'SPECIFIC_DAYS', 'WEEKLY_COUNT']) ?? 'DAILY';
  let dias: number[] | null = null;
  let cantidad: number | null = null;

  if (frecuencia === 'SPECIFIC_DAYS') {
    const arr: unknown[] = Array.isArray(raw?.dias) ? raw.dias : [];
    const nums = arr.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    dias = [...new Set(nums)].sort((a, b) => a - b);
    if (dias.length === 0) frecuencia = 'DAILY'; // sin días válidos → diario
  } else if (frecuencia === 'WEEKLY_COUNT') {
    const c = numeroPos(raw?.frecuencia_cantidad);
    cantidad = c != null ? Math.min(7, Math.round(c)) : null;
    if (cantidad == null) frecuencia = 'DAILY'; // sin cantidad → diario
  }

  const idCat = texto(raw?.id_categoria);
  // Horario: DAILY usa una sola hora (hora_inicio/hora_fin). SPECIFIC_DAYS usa horarios_dia
  // (una hora por día). WEEKLY_COUNT no tiene día fijo → sin horario.
  let hInicio: string | null = null;
  let hFin: string | null = null;
  let horariosDia: HorarioDia[] | null = null;

  if (frecuencia === 'DAILY') {
    const b = bloque(raw?.hora_inicio, raw?.hora_fin);
    hInicio = b.inicio;
    hFin = b.fin;
  } else if (frecuencia === 'SPECIFIC_DAYS') {
    const arr: unknown[] = Array.isArray(raw?.horarios_dia) ? raw.horarios_dia : [];
    const hd: HorarioDia[] = [];
    for (const h of arr) {
      const d = Number((h as any)?.dia);
      if (!Number.isInteger(d) || !(dias ?? []).includes(d)) continue;
      const b = bloque((h as any)?.hora_inicio, (h as any)?.hora_fin);
      if (b.inicio && b.fin && !hd.some((x) => x.dia === d))
        hd.push({ dia: d, hora_inicio: b.inicio, hora_fin: b.fin });
    }
    // Respaldo: si la IA mandó una sola hora suelta, la aplicamos a todos los días.
    if (hd.length === 0) {
      const b = bloque(raw?.hora_inicio, raw?.hora_fin);
      if (b.inicio && b.fin)
        for (const d of dias ?? []) hd.push({ dia: d, hora_inicio: b.inicio, hora_fin: b.fin });
    }
    horariosDia = hd.length ? hd.sort((a, b2) => a.dia - b2.dia) : null;
  }

  return {
    nombre,
    descripcion: texto(raw?.descripcion),
    tipo,
    meta_valor: tipo === 'NUMERIC' ? meta : null,
    unidad: tipo === 'NUMERIC' ? texto(raw?.unidad) : null,
    frecuencia_tipo: frecuencia,
    dias: frecuencia === 'SPECIFIC_DAYS' ? dias : null,
    frecuencia_cantidad: frecuencia === 'WEEKLY_COUNT' ? cantidad : null,
    id_categoria: idCat && categoriaIds.has(idCat) ? idCat : null, // 🔒 solo categorías reales
    fecha_inicio: fecha(raw?.fecha_inicio),
    fecha_fin: fecha(raw?.fecha_fin),
    hora_inicio: hInicio,
    hora_fin: hFin,
    horarios_dia: horariosDia,
  };
}

function saneaTarea(raw: any, categoriaIds: Set<string>): TareaPropuesta | null {
  const titulo = texto(raw?.titulo);
  if (!titulo) return null;
  const idCat = texto(raw?.id_categoria);
  return {
    titulo,
    descripcion: texto(raw?.descripcion),
    prioridad: unoDe<Prioridad>(raw?.prioridad, ['BAJA', 'MEDIA', 'ALTA']) ?? 'MEDIA',
    id_categoria: idCat && categoriaIds.has(idCat) ? idCat : null,
    fecha_limite: fecha(raw?.fecha_limite),
    hora_limite: hora(raw?.hora_limite),
  };
}

/** Un bloque ocupado (para chequear solapamientos en el cliente). */
export type BloqueOcupado = { titulo: string; fecha: string; desde: string; hasta: string };

/**
 * ¿El bloque (fecha + inicio–fin, HH:MM) se superpone con algo ocupado ese mismo día?
 * Devuelve el título del primer conflicto, o null si está libre. Comparación lexicográfica
 * de 'HH:MM' (válida por ser de largo fijo).
 */
export function conflicto(
  fecha: string,
  inicio: string,
  fin: string,
  ocupado: BloqueOcupado[],
): string | null {
  for (const c of ocupado) {
    if (c.fecha !== fecha) continue;
    if (inicio < c.hasta && c.desde < fin) return c.titulo; // solapan
  }
  return null;
}

/**
 * Fechas+horas concretas que ocupa un OBJETIVO propuesto dentro de una ventana [hoy, hoy+dias).
 * Vacío si no tiene horario o es WEEKLY_COUNT (sin día fijo).
 */
export function ocurrenciasObjetivo(o: ObjetivoPropuesto, hoy: string, dias = 21): BloqueOcupado[] {
  if (o.frecuencia_tipo === 'WEEKLY_COUNT') return [];
  const base = o.fecha_inicio && o.fecha_inicio > hoy ? o.fecha_inicio : hoy;
  const fin = sumarDiasISO(hoy, dias);
  const out: BloqueOcupado[] = [];
  const porDia = new Map((o.horarios_dia ?? []).map((h) => [h.dia, h]));

  for (let f = base; f < fin; f = sumarDiasISO(f, 1)) {
    if (o.fecha_fin && f > o.fecha_fin) break;
    if (o.frecuencia_tipo === 'DAILY') {
      if (o.hora_inicio && o.hora_fin)
        out.push({ titulo: o.nombre, fecha: f, desde: o.hora_inicio, hasta: o.hora_fin });
    } else {
      const h = porDia.get(diaSemanaISO(f));
      if (h) out.push({ titulo: o.nombre, fecha: f, desde: h.hora_inicio, hasta: h.hora_fin });
    }
  }
  return out;
}

/** Primer título con el que un objetivo/tarea se solapa (o null). Chequea todas sus ocurrencias. */
export function primerConflicto(ocurrencias: BloqueOcupado[], ocupado: BloqueOcupado[]): string | null {
  for (const oc of ocurrencias) {
    const c = conflicto(oc.fecha, oc.desde, oc.hasta, ocupado);
    if (c) return c;
  }
  return null;
}

/**
 * Primer BLOQUE ocupado con el que se solapa (con fecha y rango, para el detalle
 * "…el viernes de 16 a 18"), o null si no hay conflicto.
 */
export function detalleConflicto(
  ocurrencias: BloqueOcupado[],
  ocupado: BloqueOcupado[],
): BloqueOcupado | null {
  for (const oc of ocurrencias) {
    for (const c of ocupado) {
      if (c.fecha === oc.fecha && oc.desde < c.hasta && c.desde < oc.hasta) return c;
    }
  }
  return null;
}

/** Convierte el JSON crudo de la IA en una propuesta segura (descarta lo inválido). */
export function sanitizarPropuesta(raw: any, categoriaIds: Set<string>): PropuestaIA {
  const objetivos = Array.isArray(raw?.objetivos)
    ? raw.objetivos.map((o: any) => saneaObjetivo(o, categoriaIds)).filter(Boolean)
    : [];
  const tareas = Array.isArray(raw?.tareas)
    ? raw.tareas.map((t: any) => saneaTarea(t, categoriaIds)).filter(Boolean)
    : [];
  return {
    mensaje: texto(raw?.mensaje) ?? '',
    objetivos: objetivos as ObjetivoPropuesto[],
    tareas: tareas as TareaPropuesta[],
  };
}
