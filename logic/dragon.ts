// Estado de ánimo del dragón y su mensaje, POR REGLAS (según % del día + hora).
// No se guarda en base (🔒). Función pura → testeable, sin UI.
// La expresión (imagen) y el mensaje derivan del MISMO estado, así siempre coinciden.

export type EstadoDragon = 'manana' | 'animo' | 'orgullo' | 'festejo' | 'enojado';

/**
 * Estado del dragón según cuánto cumpliste (`percent` 0..100) y la hora local (0..23):
 *  · festejo → día completo (100%)
 *  · orgullo → muy buen avance (≥70%)
 *  · enojado → tarde (≥19h) y flojo (<50%): "se te va el día"
 *  · manana → temprano (<12h) y recién arrancando (<30%)
 *  · animo  → el resto (vas en camino)
 */
export function estadoDragon(percent: number, hora: number): EstadoDragon {
  if (percent >= 100) return 'festejo';
  if (percent >= 70) return 'orgullo';
  if (hora >= 19 && percent < 50) return 'enojado';
  if (hora < 12 && percent < 30) return 'manana';
  return 'animo';
}

/** Mensaje del dragón para cada estado. Va debajo del "Hola, {nombre}" en Hoy. */
export function mensajeDragon(estado: EstadoDragon): string {
  switch (estado) {
    case 'festejo':
      return '¡Día completo! Sos imparable 🔥';
    case 'orgullo':
      return '¡Vas increíble! Ya casi 💜';
    case 'enojado':
      return '¡Se te va el día! Sumá lo que puedas 😤';
    case 'manana':
      return 'Es hora de empezar el día ☀️';
    case 'animo':
      return '¡Vas por buen camino! ✨';
  }
}
