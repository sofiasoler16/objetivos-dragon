import type { Tarea } from '@/lib/data';
import { sumarDiasISO } from '@/logic/fecha';

/** Días que una tarea sigue visible después de completarse o de vencer. */
export const DIAS_VISIBLE_TAREA = 7;

/**
 * ¿La tarea NO se muestra más en las listas (Objetivos / Hoy)?
 * - `oculta` (eliminada a mano estando vencida) → sí.
 * - completada hace más de 7 días → sí.
 * - vencida sin hacer hace más de 7 días → sí.
 * Igual sigue contando en las stats de su día (esas no filtran por esto).
 */
export function tareaOculta(
  t: Pick<Tarea, 'oculta' | 'completada' | 'fecha_completada' | 'fecha_limite'>,
  hoy: string,
): boolean {
  if (t.oculta) return true;
  const limite = sumarDiasISO(hoy, -DIAS_VISIBLE_TAREA);
  if (t.completada) {
    const fc = t.fecha_completada?.slice(0, 10);
    return !!fc && fc < limite; // completada hace más de 7 días
  }
  const fl = t.fecha_limite?.slice(0, 10);
  return !!fl && fl < limite; // vencida sin hacer hace más de 7 días
}

const PRIORIDAD: Record<Tarea['prioridad'], string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
};

/** Texto corto de una tarea (vencimiento + prioridad) para la lista. */
export function resumenTarea(t: Pick<Tarea, 'fecha_limite' | 'prioridad'>): string {
  const partes: string[] = [];
  if (t.fecha_limite) {
    const [, m, d] = t.fecha_limite.split('-');
    partes.push(`Vence ${d}/${m}`);
  }
  partes.push(PRIORIDAD[t.prioridad]);
  return partes.join(' · ');
}
