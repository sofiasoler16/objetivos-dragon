// Paleta fija de colores de eventos de Google Calendar (colorId 1..11). Es la MISMA paleta que
// usa la API de Google (event.colorId), así el color elegido en la app mapea directo cuando se
// empuje al calendario real (Fase B). El hex es la aproximación con la que pintamos en la app.

export type ColorCalendario = {
  id: string; // colorId de Google ('1'..'11')
  nombre: string;
  hex: string;
};

export const COLORES_CALENDARIO: ColorCalendario[] = [
  { id: '1', nombre: 'Lavanda', hex: '#7986CB' },
  { id: '2', nombre: 'Salvia', hex: '#33B679' },
  { id: '3', nombre: 'Uva', hex: '#8E24AA' },
  { id: '4', nombre: 'Flamenco', hex: '#E67C73' },
  { id: '5', nombre: 'Banana', hex: '#F6BF26' },
  { id: '6', nombre: 'Mandarina', hex: '#F4511E' },
  { id: '7', nombre: 'Pavo real', hex: '#039BE5' },
  { id: '8', nombre: 'Grafito', hex: '#616161' },
  { id: '9', nombre: 'Arándano', hex: '#3F51B5' },
  { id: '10', nombre: 'Albahaca', hex: '#0B8043' },
  { id: '11', nombre: 'Tomate', hex: '#D50000' },
];

const PORID = new Map(COLORES_CALENDARIO.map((c) => [c.id, c]));

/** Hex del colorId (o `fallback` si es null/desconocido). */
export function hexDeColor(colorId: string | null | undefined, fallback: string): string {
  return (colorId && PORID.get(colorId)?.hex) || fallback;
}

/** Nombre legible del colorId (o null). */
export function nombreDeColor(colorId: string | null | undefined): string | null {
  return (colorId && PORID.get(colorId)?.nombre) || null;
}
