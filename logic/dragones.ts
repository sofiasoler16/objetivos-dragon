// Estado de cada dragón en la colección y evaluación de requisitos. Funciones PURAS.
// Los requisitos "de historial" (TOTAL_OBJETIVOS, etc.) se refinan más adelante; por
// ahora se resuelven los simples (FREE / NIVEL / XP) desde el caché del perfil.

export const XP_POR_NIVEL = 100;

/** Nivel actual a partir del XP acumulado (nivel = XP/100 + 1). */
export function nivelDesdeXp(xpTotal: number): number {
  return Math.floor(xpTotal / XP_POR_NIVEL) + 1;
}

/** XP dentro del nivel actual (0..99): lo que se muestra y "se reinicia" al subir. */
export function xpEnNivel(xpTotal: number): number {
  return xpTotal % XP_POR_NIVEL;
}

/** Progreso hacia el próximo nivel, en [0..1] (para la barra). */
export function progresoNivel(xpTotal: number): number {
  return (xpTotal % XP_POR_NIVEL) / XP_POR_NIVEL;
}

// 'premium'          = requiere Premium y NO lo tenés → hay que conseguirlo.
// 'premium_bloqueado' = lo tenés (es tuyo), pero sin Premium no lo podés usar → reactivar Premium.
export type EstadoColeccion =
  | 'equipado'
  | 'en_coleccion'
  | 'disponible'
  | 'bloqueado'
  | 'premium'
  | 'premium_bloqueado';

type ReglaLike = { rule_type: string; target_value: number | null } | null;
type DragonLike = {
  credit_cost: number;
  premium_required: boolean;
  adquirido: boolean;
  equipado: boolean;
  regla: ReglaLike;
};
type StatsLike = { nivel: number; xp_total: number };

/**
 * ¿El usuario cumple el requisito de desbloqueo para PODER comprar el dragón?
 * FREE/NIVEL/XP se resuelven con el caché del perfil. Las reglas de HISTORIAL
 * (SEMANA_PERFECTA, RACHA…) se cumplen cuando el usuario ya desbloqueó un logro
 * de ese mismo `rule_type` (mismo criterio que valida el servidor al comprar).
 */
export function requisitoCumplido(
  regla: ReglaLike,
  stats: StatsLike,
  logrosDesbloqueados?: Set<string>,
): boolean {
  if (!regla || regla.rule_type === 'FREE') return true;
  const objetivo = regla.target_value ?? 0;
  switch (regla.rule_type) {
    case 'NIVEL':
      return stats.nivel >= objetivo;
    case 'XP':
      return stats.xp_total >= objetivo;
    default:
      // reglas basadas en historial → se habilitan con el logro correspondiente
      return logrosDesbloqueados?.has(regla.rule_type) ?? false;
  }
}

/** Estado del dragón para agruparlo en la pantalla "Mi Dragón". */
export function estadoColeccion(
  d: DragonLike,
  stats: StatsLike,
  esPremium: boolean,
  logrosDesbloqueados?: Set<string>,
): EstadoColeccion {
  // Premium primero: los dragones premium NO se pueden usar sin Premium, aunque los tengas.
  // (La posesión NO se pierde: al reactivar Premium vuelven a estar disponibles/equipables.)
  if (d.premium_required && !esPremium) return d.adquirido ? 'premium_bloqueado' : 'premium';
  if (d.adquirido) return d.equipado ? 'equipado' : 'en_coleccion';
  return requisitoCumplido(d.regla, stats, logrosDesbloqueados) ? 'disponible' : 'bloqueado';
}

/** Texto del requisito (para las tarjetas bloqueadas). null si es FREE. */
export function textoRequisito(regla: ReglaLike): string | null {
  if (!regla || regla.rule_type === 'FREE') return null;
  const objetivo = regla.target_value ?? 0;
  switch (regla.rule_type) {
    case 'NIVEL':
      return `Nivel ${objetivo}`;
    case 'XP':
      return `${objetivo} XP`;
    case 'TOTAL_OBJETIVOS':
      return `${objetivo} objetivos cumplidos`;
    case 'TOTAL_TAREAS':
      return `${objetivo} tareas completadas`;
    case 'SEMANA_PERFECTA':
      return 'el logro “Semana perfecta”';
    case 'RACHA':
      return `el logro de racha (${objetivo} días)`;
    default:
      return 'Requisito especial';
  }
}

/**
 * Cómo se consigue un dragón, IGNORANDO Premium (monedas / nivel / logro / gratis). La condición
 * de Premium se muestra aparte (corona + candado). Sirve para que CADA dragón diga su vía real.
 */
export function viaDeConseguir(d: { credit_cost: number; regla: ReglaLike }): string {
  if (d.credit_cost > 0) return `${d.credit_cost} 🪙`;
  return textoRequisito(d.regla) ?? 'Gratis';
}
