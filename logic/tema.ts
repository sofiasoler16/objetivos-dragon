// Convierte un tema de la base (9 colores base) a la paleta COMPLETA que usa la app.
// Detecta si el tema es OSCURO (por la luminancia del fondo) y deriva las variantes
// acorde: en claro, los "100"/tarjetas van hacia el blanco y los "700" oscurecen;
// en oscuro, los "100"/tarjetas se mezclan con la superficie (oscuros) y los "700"
// se aclaran (para que el texto sobre chips se lea). Función pura.
import type { Tema } from '@/constants/theme';
import type { Tables } from '@/lib/types';

export type TemaDB = Tables<'tema'>;

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('');
}
/** Mezcla dos colores: t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
function tint(hex: string, t: number): string {
  return mix(hex, '#ffffff', t);
}
function shade(hex: string, t: number): string {
  return mix(hex, '#000000', t);
}
function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function luminancia(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function temaAColores(db: TemaDB): Tema {
  const P = db.primary_color;
  const S = db.secondary_color;
  const SU = db.success_color;
  const W = db.warning_color;
  const SUR = db.surface_color;
  const oscuro = luminancia(db.background_color) < 0.5;

  // Variante clara "100" (fondo de chip) y "700" (texto sobre el chip / títulos).
  const chip = (c: string) => (oscuro ? mix(c, SUR, 0.72) : tint(c, 0.86));
  const fuerte = (c: string) => (oscuro ? tint(c, 0.45) : shade(c, 0.28));

  return {
    bg: db.background_color,
    card: SUR,
    surface: SUR,
    cardPurple: oscuro ? mix(SUR, P, 0.22) : tint(P, 0.9),
    cardOrange: oscuro ? mix(SUR, W, 0.2) : tint(W, 0.86),
    text: db.text_primary,
    textMuted: db.text_secondary,
    divider: oscuro ? 'rgba(255, 255, 255, 0.12)' : alpha(db.text_primary, 0.09),

    purple: P,
    purple100: chip(P),
    purple700: fuerte(P),

    green: SU,
    green100: chip(SU),
    green700: fuerte(SU),

    blue: S,
    blue100: chip(S),
    blue700: fuerte(S),

    orange: W,
    orangeChip: oscuro ? mix(W, SUR, 0.55) : tint(W, 0.62),
    orangeChipText: fuerte(W),

    track: oscuro ? mix(SUR, '#ffffff', 0.14) : tint(P, 0.84),
    red: oscuro ? '#ff6b6b' : '#c0392b',
    redBorder: oscuro ? 'rgba(255, 107, 107, 0.4)' : '#f3d6d1',

    accent: P,
    accent100: chip(P),
    accent700: fuerte(P),
    accent2_100: chip(SU),
    accent2_700: fuerte(SU),
    neutral200: oscuro ? mix(SUR, '#ffffff', 0.14) : tint(P, 0.84),
  };
}
