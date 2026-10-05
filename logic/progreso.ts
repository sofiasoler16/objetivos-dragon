// Reglas de agregación de Progreso. Funciones PURAS (sin UI, sin red) → testeables.
// TODO sale del historial (`registro_objetivo`, vía RPCs); nunca del estado del objetivo (🔒).
// Métrica principal = CONSISTENCIA = sum(credito) / sum(esperados) del período.
import { diaSemanaISO, sumarDiasISO } from './fecha';

/** Fila de `progreso_por_dia`: cumplimiento de un día. */
export type DiaProgreso = { fecha: string; esperados: number; credito: number; pct: number };

/** Fila de `progreso_por_objetivo`: cumplimiento de un objetivo en el rango. */
export type ObjetivoProgreso = {
  id_objetivo: string;
  nombre: string;
  id_categoria: string | null;
  tipo: 'BOOLEAN' | 'NUMERIC' | 'DURATION';
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

/** Consistencia (%) agrupada por MES a partir de los días. Ordenada del mes más viejo al más nuevo. */
export function tendenciaMensual(dias: DiaProgreso[]): { mesISO: string; pct: number; esperados: number }[] {
  const acc = new Map<string, { credito: number; esperados: number }>();
  for (const d of dias) {
    const key = d.fecha.slice(0, 7); // 'YYYY-MM'
    const a = acc.get(key) ?? { credito: 0, esperados: 0 };
    a.credito += d.credito;
    a.esperados += d.esperados;
    acc.set(key, a);
  }
  return [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, a]) => ({
      mesISO: `${k}-01`,
      esperados: a.esperados,
      pct: a.esperados > 0 ? Math.round((a.credito / a.esperados) * 100) : 0,
    }));
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

/** % mínimo del día para que cuente en la racha (no hace falta el 100%). */
export const UMBRAL_RACHA = 85;

/**
 * Racha actual = días consecutivos (hacia atrás desde hoy) con el día cumplido (≥ `umbral`, 85% por
 * defecto). Los días SIN objetivos no cuentan ni cortan. Hoy incompleto no corta (el día sigue).
 * `congeladas` = días protegidos por un congelador: se saltean como neutrales (no cortan la racha).
 * Métrica secundaria (la principal es la consistencia). Necesita `dias` hasta hoy.
 */
export function rachaActual(
  dias: DiaProgreso[],
  hoy: string,
  umbral = UMBRAL_RACHA,
  congeladas: Set<string> = new Set(),
): number {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  let racha = 0;
  let fecha = hoy;
  let esHoy = true;
  for (let i = 0; i < 400; i++) {
    if (congeladas.has(fecha)) {
      // día protegido por un congelador → neutral (no corta ni suma)
      esHoy = false;
      fecha = sumarDiasISO(fecha, -1);
      continue;
    }
    const d = porFecha.get(fecha);
    if (!d) break; // sin datos más atrás → cortar
    if (d.esperados === 0) {
      // día sin objetivos: neutral
    } else if (d.pct >= umbral) {
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

// ─── Insights (carrusel de Progreso) ─────────────────────────────────────────
// Datos "interesantes" derivados del historial (día de la semana más fuerte, hábito que mejor
// cumplís, el que más se te escapa…). Todo PURO: la pantalla los muestra en un carrusel.

const DIAS_INSIGHT = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export type Insight = { id: string; icono: string; titulo: string; texto: string };

/** Día de la semana (ISO 1..7) con mejor consistencia en el rango, o null si hay pocos datos. */
export function mejorDiaSemana(dias: DiaProgreso[]): { isoDow: number; pct: number } | null {
  const acc = new Map<number, { credito: number; esperados: number }>();
  for (const d of dias) {
    const dow = diaSemanaISO(d.fecha);
    const a = acc.get(dow) ?? { credito: 0, esperados: 0 };
    a.credito += d.credito;
    a.esperados += d.esperados;
    acc.set(dow, a);
  }
  let mejor: { isoDow: number; pct: number } | null = null;
  for (const [dow, a] of acc) {
    if (a.esperados < 3) continue; // muy pocos datos para ese día
    const pct = Math.round((a.credito / a.esperados) * 100);
    if (!mejor || pct > mejor.pct) mejor = { isoDow: dow, pct };
  }
  return mejor;
}

/** Objetivo con mejor (o peor) cumplimiento del rango, exigiendo un mínimo de ocurrencias. */
export function objetivoDestacado(
  objs: ObjetivoProgreso[],
  modo: 'mejor' | 'peor',
  minEsperados = 4,
): ObjetivoProgreso | null {
  const elegibles = objs.filter((o) => o.esperados >= minEsperados);
  if (elegibles.length === 0) return null;
  return elegibles.reduce((best, o) =>
    modo === 'mejor' ? (o.pct > best.pct ? o : best) : o.pct < best.pct ? o : best,
  );
}

/**
 * Arma las tarjetas del carrusel a partir del historial del usuario (ventana = mes/año según el
 * plan, NO solo la semana). Personalizado: solo incluye las que tienen datos suficientes (usuario
 * nuevo → lista vacía) y las ORDENA por relevancia (`peso`), así el orden cambia según cada usuario.
 */
export function construirInsights(input: {
  diasVentana: DiaProgreso[];
  objsVentana: ObjetivoProgreso[];
  racha: number;
}): Insight[] {
  const cand: (Insight & { peso: number })[] = [];

  // Objetivo que más se le escapa → cuanto más bajo, más urgente (arriba del todo).
  const peor = objetivoDestacado(input.objsVentana, 'peor');
  if (peor && peor.pct < 55) {
    cand.push({
      id: 'peor-obj',
      icono: 'alert-circle-outline',
      titulo: 'Para prestar atención',
      texto: `“${peor.nombre}” te está costando (${peor.pct}%). ¿Le damos una mano? 💪`,
      peso: 100 - peor.pct, // pct 20 → 80 ; pct 50 → 50
    });
  }

  // Tendencia del mes vs el anterior (necesita ≥2 meses con datos).
  const meses = tendenciaMensual(input.diasVentana).filter((m) => m.esperados > 0);
  if (meses.length >= 2) {
    const ult = meses[meses.length - 1];
    const prev = meses[meses.length - 2];
    const dif = ult.pct - prev.pct;
    if (dif >= 5) {
      cand.push({
        id: 'mejorando',
        icono: 'trending-up-outline',
        titulo: 'Vas mejorando',
        texto: `Este mes subiste del ${prev.pct}% al ${ult.pct}%. ¡Se nota el esfuerzo! 📈`,
        peso: 60 + Math.min(20, dif),
      });
    } else if (dif <= -8) {
      cand.push({
        id: 'bajando',
        icono: 'trending-down-outline',
        titulo: 'Ojo con el mes',
        texto: `Bajaste del ${prev.pct}% al ${ult.pct}%. Un pequeño empujón y lo das vuelta 🌱`,
        peso: 55 + Math.min(20, -dif),
      });
    }
  }

  // Racha activa.
  if (input.racha >= 3) {
    cand.push({
      id: 'racha',
      icono: 'flame-outline',
      titulo: 'En racha',
      texto: `Llevás ${input.racha} días seguidos cumpliendo. ¡No la cortes! 🐉`,
      peso: 45 + Math.min(40, input.racha * 3), // racha 3 → 54 ; racha 15+ → 85
    });
  }

  // Objetivo que mejor cumple.
  const mejor = objetivoDestacado(input.objsVentana, 'mejor');
  if (mejor && mejor.pct >= 60) {
    cand.push({
      id: 'mejor-obj',
      icono: 'trophy-outline',
      titulo: 'Lo que mejor hacés',
      texto: `“${mejor.nombre}”: lo cumplís el ${mejor.pct}% de las veces. 🔥`,
      peso: mejor.pct - 20, // pct 90 → 70 ; pct 60 → 40
    });
  }

  // Día de la semana más fuerte (mira TODAS las semanas de la ventana).
  const md = mejorDiaSemana(input.diasVentana);
  if (md && md.pct >= 40) {
    cand.push({
      id: 'mejor-dia',
      icono: 'sunny-outline',
      titulo: 'Tu mejor día',
      texto: `Los ${DIAS_INSIGHT[md.isoDow]} sos más constante: ${md.pct}% en promedio. ✨`,
      peso: md.pct - 25,
    });
  }

  // Orden por relevancia (desc); desempate estable por id para que no “salte” entre renders.
  return cand
    .sort((a, b) => b.peso - a.peso || a.id.localeCompare(b.id))
    .map(({ peso: _peso, ...rest }) => rest);
}
