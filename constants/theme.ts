// FUENTE ÚNICA DE COLOR: los componentes NUNCA hardcodean hex.
// Con el sistema de temas (V3), los colores se leen con `useTheme()` (components/
// theme-provider) según el dragón equipado. `Tema` es la forma completa de la paleta;
// `TEMA_ORIGINAL` es el tema por defecto (y el fallback mientras no hay sesión/tema).
// `colors` queda como alias de TEMA_ORIGINAL (respaldo estático).
export type Tema = {
  bg: string;
  card: string;
  surface: string;
  cardPurple: string;
  cardOrange: string;
  text: string;
  textMuted: string;
  divider: string;
  purple: string;
  purple100: string;
  purple700: string;
  green: string;
  green100: string;
  green700: string;
  blue: string;
  blue100: string;
  blue700: string;
  orange: string;
  orangeChip: string;
  orangeChipText: string;
  track: string;
  red: string;
  redBorder: string;
  accent: string;
  accent100: string;
  accent700: string;
  accent2_100: string;
  accent2_700: string;
  neutral200: string;
};

export const TEMA_ORIGINAL: Tema = {
  bg: '#f1f8f3',
  card: '#ffffff',
  surface: '#ffffff',
  cardPurple: '#ede9fb',
  cardOrange: '#fdf1de',
  text: '#241f38',
  textMuted: 'rgba(36,31,56,0.55)',
  divider: 'rgba(36,31,56,0.09)',

  purple: '#7c3aed',
  purple100: '#ede9fe',
  purple700: '#5b21b6',

  green: '#22c55e',
  green100: '#dcfce7',
  green700: '#15803d',

  blue: '#3b82f6',
  blue100: '#dbeafe',
  blue700: '#1d4ed8',

  orange: '#e08a2c',
  orangeChip: '#f7ddaa',
  orangeChipText: '#8a5a12',

  track: '#e7e2f6',
  red: '#c0392b',
  redBorder: '#f3d6d1',

  // Aliases semánticos usados por Card / ProgressBar / Tag:
  accent: '#7c3aed', // = purple
  accent100: '#ede9fe', // = purple100
  accent700: '#5b21b6', // = purple700
  accent2_100: '#dcfce7', // = green100
  accent2_700: '#15803d', // = green700
  neutral200: '#e7e2f6', // = track
};

/** Alias de respaldo (tema por defecto). Preferí `useTheme()` para que responda al dragón. */
export const colors = TEMA_ORIGINAL;

export const fonts = {
  heading: 'System', // cambiar por una display redondeada si la marca suma fuente
  body: 'System',
  bodySemibold: 'System',
};

export const radius = { sm: 8, md: 16, lg: 20, pill: 999 };
export const spacing = { xs: 4, sm: 9, md: 13, lg: 18, xl: 26, xxl: 35 };
export const shadow = {
  sm: {
    shadowColor: '#241f38',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};
