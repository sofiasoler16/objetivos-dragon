// Reglas de agregación de Progreso. Funciones PURAS (sin UI, sin red) → testeables.
// TODO sale del historial (`registro_objetivo`, vía RPCs); nunca del estado del objetivo (🔒).
// Métrica principal = CONSISTENCIA = sum(credito) / sum(esperados) del período.
import { sumarDiasISO } from './fecha';

/** Fila de `progreso_por_dia`: cumplimiento de un día. */
export type DiaProgreso = { fecha: string; esperados: number; credito: number; pct: number };

/** Fila de `progreso_por_objetivo`: cumplimiento de un objetivo en el rango. */
export type ObjetivoProgreso = {
  id_objetivo: string;
  nombre: string;
  id_categoria: string | null;
  tipo: 'BOOLEAN' | 'NUMERIC';
  esperados: number;
  credito: number;
  pct: number;
};

export type Resumen = { esperados: number; credito: number; pct: number };

/** Consistencia de un conjunto de días: sum(credito)/sum(esperados) → %. */
export function resumenRango(dias: DiaProgreso[]): Resumen {
  const esperados = dias.reduce((a, d) => a + d.esperados, 0);
  const credito = dias.reduce((a, d) => a + d.credito, 0);
  return { esperados, credito, pct: esperados > 0 ? Math.round((credito / esperados) * 100) : 0 };
}

/** Diferencia en puntos de % entre esta semana y la anterior (para el "+11%"). */
export function delta(actual: Resumen, anterior: Resumen): number {
  return actual.pct - anterior.pct;
}

/** Objetivos agrupados por categoría, con la consistencia de cada grupo. */
export type CategoriaAgrupada = {
  id_categoria: string | null;
  esperados: number;
  credito: number;
  pct: number;
  objetivos: ObjetivoProgreso[];
};

export function agruparPorCategoria(objs: ObjetivoProgreso[]): CategoriaAgrupada[] {
  const map = new Map<string, CategoriaAgrupada>();
  for (const o of objs) {
    const key = o.id_categoria ?? '__sin__';
    let g = map.get(key);
    if (!g) {
      g = { id_categoria: o.id_categoria, esperados: 0, credito: 0, pct: 0, objetivos: [] };
      map.set(key, g);
    }
    g.esperados += o.esperados;
    g.credito += o.credito;
    g.objetivos.push(o);
  }
  const grupos = [...map.values()];
  for (const g of grupos) g.pct = g.esperados > 0 ? Math.round((g.credito / g.esperados) * 100) : 0;
  return grupos.sort((a, b) => b.pct - a.pct);
}

/** Celda de un día para la fila L→D y el calendario. `pct` null = sin objetivos o futuro. */
export type CeldaDia = { label: string; fecha: string; pct: number | null };

const ETIQUETAS_LD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Los 7 días (lunes→domingo) de la semana que arranca en `inicioSemana`. */
export function semanaLD(dias: DiaProgreso[], inicioSemana: string, hoy: string): CeldaDia[] {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  return ETIQUETAS_LD.map((label, i) => {
    const fecha = sumarDiasISO(inicioSemana, i);
    const d = porFecha.get(fecha);
    const pct = fecha > hoy || !d || d.esperados === 0 ? null : d.pct;
    return { label, fecha, pct };
  });
}

/** Nivel de intensidad 0..4 según el % del día (para el color del calendario). */
export function nivelIntensidad(pct: number | null): 0 | 1 | 2 | 3 | 4 {
  if (pct == null) return 0;
  if (pct >= 100) return 4;
  if (pct >= 67) return 3;
  if (pct >= 34) return 2;
  if (pct > 0) return 1;
  return 0;
}

/**
 * Racha actual = días consecutivos (hacia atrás desde hoy) con el día completo (100%).
 * Los días SIN objetivos no cuentan ni cortan. Hoy incompleto no corta (el día sigue).
 * Métrica secundaria (la principal es la consistencia). Necesita `dias` hasta hoy.
 */
export function rachaActual(dias: DiaProgreso[], hoy: string): number {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  let racha = 0;
  let fecha = hoy;
  let esHoy = true;
  for (let i = 0; i < 400; i++) {
    const d = porFecha.get(fecha);
    if (!d) break; // sin datos más atrás → cortar
    if (d.esperados === 0) {
      // día sin objetivos: neutral
    } else if (d.pct >= 100) {
      racha++;
    } else if (!esHoy) {
      break; // día pasado incompleto → corta la racha
    }
    esHoy = false;
    fecha = sumarDiasISO(fecha, -1);
  }
  return racha;
}

/** Mensaje del dragón para Progreso, según la consistencia semanal. Por reglas, no se guarda. */
export function mensajeProgreso(pct: number): string {
  if (pct >= 85) return '¡Semana espectacular! 💚';
  if (pct >= 60) return '¡Vas muy bien! Seguí así 💪';
  if (pct >= 30) return 'Paso a paso se construye ✨';
  return 'Arranquemos de nuevo, ¡vos podés! 🌱';
}
