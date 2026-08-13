// Qué recordatorios corresponden a los objetivos y tareas. Funciones PURAS: NO
// tocan la API del sistema (eso vive en lib/notificaciones.ts) → testeables.
// El disparador se describe de forma neutra y lib/notificaciones lo traduce a
// expo-notifications. isoDow = 1..7 (lunes..domingo), consistente con objetivo_dia.

export type Disparador =
  | { tipo: 'diario'; hora: number; minuto: number }
  | { tipo: 'semanal'; isoDow: number; hora: number; minuto: number }
  | { tipo: 'fecha'; anio: number; mes: number; dia: number; hora: number; minuto: number };

export type Recordatorio = {
  clave: string; // id estable (debug)
  titulo: string;
  cuerpo: string;
  disparador: Disparador;
};

/** Objetivo (subset que necesita el recordatorio). `dias` en ISO 1..7. */
type ObjetivoRec = {
  id_objetivo: string;
  nombre: string;
  frecuencia_tipo: 'DAILY' | 'SPECIFIC_DAYS' | 'WEEKLY_COUNT';
  hora_recordatorio: string | null;
  dias?: number[];
};

/** Tarea (subset). `fecha_limite` ISO 'YYYY-MM-DD', `hora_limite` 'HH:MM:SS'. */
type TareaRec = {
  id_tarea: string;
  titulo: string;
  completada: boolean;
  fecha_limite: string | null;
  hora_limite: string | null;
};

/** 'HH:MM[:SS]' → { hora, minuto }. */
function parseHora(hhmm: string): { hora: number; minuto: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hora: h || 0, minuto: m || 0 };
}

const HORA_TAREA_DEFAULT = { hora: 9, minuto: 0 }; // si la tarea no tiene hora_limite
const DIAS_WEEKLY_COUNT = [1, 3, 5]; // ISO: lunes, miércoles, viernes

/** Recordatorios de un objetivo según su frecuencia (0..n). Sin hora → ninguno. */
export function recordatoriosDeObjetivo(o: ObjetivoRec): Recordatorio[] {
  if (!o.hora_recordatorio) return [];
  const { hora, minuto } = parseHora(o.hora_recordatorio);
  const titulo = `🐉 ${o.nombre}`;
  const cuerpo = '¡Es hora de tu objetivo de hoy!';

  if (o.frecuencia_tipo === 'DAILY') {
    return [{ clave: `obj-${o.id_objetivo}-daily`, titulo, cuerpo, disparador: { tipo: 'diario', hora, minuto } }];
  }
  if (o.frecuencia_tipo === 'SPECIFIC_DAYS') {
    return (o.dias ?? []).map((isoDow) => ({
      clave: `obj-${o.id_objetivo}-dow${isoDow}`,
      titulo,
      cuerpo,
      disparador: { tipo: 'semanal', isoDow, hora, minuto },
    }));
  }
  // WEEKLY_COUNT no tiene día fijo → recordamos lun/mié/vie (nudges sin saturar).
  return DIAS_WEEKLY_COUNT.map((isoDow) => ({
    clave: `obj-${o.id_objetivo}-wc${isoDow}`,
    titulo,
    cuerpo: '¿Sumás tu objetivo de la semana?',
    disparador: { tipo: 'semanal', isoDow, hora, minuto },
  }));
}

/** Recordatorio único de una tarea (o null si está completa, sin fecha, o ya venció). */
export function recordatorioDeTarea(t: TareaRec, hoyISO: string): Recordatorio | null {
  if (t.completada || !t.fecha_limite) return null;
  if (t.fecha_limite < hoyISO) return null; // ya vencida
  const { hora, minuto } = t.hora_limite ? parseHora(t.hora_limite) : HORA_TAREA_DEFAULT;
  const [anio, mes, dia] = t.fecha_limite.split('-').map(Number);
  return {
    clave: `tarea-${t.id_tarea}`,
    titulo: `📋 ${t.titulo}`,
    cuerpo: 'Tenés una tarea pendiente para hoy.',
    disparador: { tipo: 'fecha', anio, mes, dia, hora, minuto },
  };
}

/** Todos los recordatorios a programar, desde objetivos + tareas. */
export function construirRecordatorios(
  objetivos: ObjetivoRec[],
  tareas: TareaRec[],
  hoyISO: string,
): Recordatorio[] {
  const deObjetivos = objetivos.flatMap(recordatoriosDeObjetivo);
  const deTareas = tareas
    .map((t) => recordatorioDeTarea(t, hoyISO))
    .filter((r): r is Recordatorio => r !== null);
  return [...deObjetivos, ...deTareas];
}
