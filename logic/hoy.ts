// Reglas de cálculo del % del día y del mensaje del dragón. Funciones PURAS
// (sin UI, sin red) → testeables. Reglas cerradas (ver 🔒 en CLAUDE.md):
//  · denominador = obligatorios de hoy (DAILY + SPECIFIC_DAYS que caen hoy), SIN omitidos.
//  · numéricos = crédito proporcional (valor/meta, tope 1).
//  · omitido queda fuera del numerador Y del denominador.
//  · WEEKLY_COUNT no entra acá (no penaliza el % del día).

/** Fila que devuelve la RPC `esperados_hoy` (obligatorios de hoy + su registro). */
export type EsperadoHoy = {
  id_objetivo: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'BOOLEAN' | 'NUMERIC';
  frecuencia_tipo: 'DAILY' | 'SPECIFIC_DAYS' | 'WEEKLY_COUNT';
  meta_valor: number | null;
  unidad: string | null;
  id_categoria: string | null;
  hora_recordatorio: string | null;
  completado: boolean;
  valor: number | null;
  omitido: boolean;
};

/** Crédito de un objetivo en [0..1]. Numérico = proporcional; booleano = 0 o 1. */
export function creditoObjetivo(o: EsperadoHoy): number {
  if (o.tipo === 'NUMERIC' && o.meta_valor && o.meta_valor > 0) {
    return Math.min(1, Math.max(0, (o.valor ?? 0) / o.meta_valor));
  }
  return o.completado ? 1 : 0;
}

/** % del día (0..100). Denominador = obligatorios de hoy sin omitidos. */
export function porcentajeDia(esperados: EsperadoHoy[]): number {
  const cuentan = esperados.filter((o) => !o.omitido);
  if (cuentan.length === 0) return 0;
  const suma = cuentan.reduce((acc, o) => acc + creditoObjetivo(o), 0);
  return Math.round((suma / cuentan.length) * 100);
}

// El estado y el mensaje del dragón viven en logic/dragon.ts (estadoDragon / mensajeDragon).

/** Redondea a un número "lindo" (1/2/2,5/5 × 10ⁿ) para mostrar en botones. */
function pasoLindo(x: number): number {
  if (x <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const norm = x / mag; // 1..10
  const nice = norm < 1.5 ? 1 : norm < 2.25 ? 2 : norm < 3.75 ? 2.5 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

/**
 * Dos incrementos rápidos derivados de la meta (chico y grande).
 * Ej: meta 2000 → [250, 500]; meta 30 → [5, 10]; meta 10 → [1, 2.5].
 */
export function pasosNumericos(meta: number | null): [number, number] {
  const m = meta && meta > 0 ? meta : 8;
  const chico = pasoLindo(m / 8);
  const grande = pasoLindo(m / 4);
  return [chico, grande > chico ? grande : chico * 2];
}
