import type { ObjetivoConDias } from '@/lib/data';

const DIAS_CORTOS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // ISO 1..7

/** Texto corto de la frecuencia de un objetivo para mostrar en la lista. */
export function resumenFrecuencia(
  o: Pick<ObjetivoConDias, 'frecuencia_tipo' | 'frecuencia_cantidad' | 'dias'>,
): string {
  switch (o.frecuencia_tipo) {
    case 'DAILY':
      return 'Todos los días';
    case 'WEEKLY_COUNT':
      return `${o.frecuencia_cantidad ?? '?'}× por semana`;
    case 'SPECIFIC_DAYS':
      return o.dias.length ? o.dias.map((d) => DIAS_CORTOS[d]).join(', ') : 'Días específicos';
  }
}
