// Paleta "Original" — portada del mockup aprobado (violeta/verde/azul sobre crema).
// FUENTE ÚNICA DE COLOR: los componentes NUNCA hardcodean hex, importan de acá.
// Cuando llegue el sistema de temas del dragón (V3, ver Anexo del CLAUDE.md),
// este objeto pasa a ser el tema "Original" y se accede vía un useTheme() para
// poder intercambiarlo al equipar otro dragón. Por ahora es estático.
export const colors = {
  bg: '#faf6ef',
  card: '#ffffff',
  surface: '#ffffff', // alias de card (lo usan algunos componentes base)
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
