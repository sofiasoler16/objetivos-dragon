import type { Tarea } from '@/lib/data';

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
