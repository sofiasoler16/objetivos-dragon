// Formato de eventos de calendario — funciones puras (sin UI ni nativo).
import { diaSemanaISO, sumarDiasISO } from './fecha';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Nombre del día de la semana de una fecha ISO (1=lunes…7=domingo). */
export function nombreDia(iso: string): string {
  return DIAS[diaSemanaISO(iso)] ?? '';
}

/** 'HH:MM' en hora local del dispositivo. Ojo: no usar en eventos de todo el día. */
export function horaHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Texto del horario: 'Todo el día' o 'HH:MM–HH:MM'. */
export function rangoHorario(e: { inicio: string; fin: string; todoElDia: boolean }): string {
  if (e.todoElDia) return 'Todo el día';
  return `${horaHHMM(e.inicio)}–${horaHHMM(e.fin)}`;
}

/**
 * Primera fecha ISO (>= desdeISO) cuyo día ISO esté en `dias`. Si `dias` está vacío,
 * devuelve `desdeISO` (sirve para eventos diarios/únicos). Busca hasta 7 días adelante.
 */
export function primeraFechaOcurrencia(desdeISO: string, dias: number[]): string {
  if (dias.length === 0) return desdeISO;
  for (let i = 0; i < 7; i++) {
    const f = sumarDiasISO(desdeISO, i);
    if (dias.includes(diaSemanaISO(f))) return f;
  }
  return desdeISO;
}
