// Puente con Health Connect (Android). ÚNICO lugar que habla con el módulo nativo
// `react-native-health-connect`; la capa /lib/data lo orquesta y la UI nunca lo llama directo.
// Lee (solo lectura): PASOS y NUTRICIÓN (calorías + comidas). Requiere dev/standalone build.
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

/** Métricas de Health Connect que soporta la app (cada una = un tipo de dato). */
export type MetricaHC = 'STEPS' | 'CALORIES';
const RECORD: Record<MetricaHC, 'Steps' | 'Nutrition'> = { STEPS: 'Steps', CALORIES: 'Nutrition' };

const permisoDe = (m: MetricaHC) => ({ accessType: 'read', recordType: RECORD[m] }) as const;
const tieneRecord = (
  concedidos: { accessType?: string; recordType?: string }[],
  rt: string,
) => concedidos.some((p) => p.recordType === rt && p.accessType === 'read');

/**
 * Rango de un día (yyyy-mm-dd, hora local): medianoche → medianoche del día siguiente, pero sin
 * pasar de "ahora" (no se lee el futuro). Sirve tanto para HOY como para días anteriores
 * (Health Connect guarda el histórico, así que se pueden traer días pasados).
 */
function rangoDia(fechaISO: string) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
  const finDia = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const fin = new Date(Math.min(finDia.getTime(), Date.now()));
  return { operator: 'between' as const, startTime: inicio.toISOString(), endTime: fin.toISOString() };
}

/** ¿Health Connect está disponible en este dispositivo? (no lanza) */
export async function healthConnectDisponible(): Promise<boolean> {
  try {
    return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/** ¿Ya tenemos permiso de lectura de esta métrica? (NO dispara el diálogo) */
export async function tienePermiso(m: MetricaHC): Promise<boolean> {
  if (!(await initialize())) return false;
  return tieneRecord(await getGrantedPermissions(), RECORD[m]);
}

/** Pide el permiso de lectura de una métrica (dispara el diálogo si hace falta). */
export async function pedirPermiso(m: MetricaHC): Promise<boolean> {
  if (!(await initialize())) return false;
  if (tieneRecord(await getGrantedPermissions(), RECORD[m])) return true;
  const otorgados = await requestPermission([permisoDe(m)]);
  return tieneRecord(otorgados, RECORD[m]);
}

/** Conecta Health Connect pidiendo TODOS los permisos de lectura de una (para la sección Permisos). */
export async function conectarHealthConnect(): Promise<boolean> {
  if (!(await initialize())) return false;
  const otorgados = await requestPermission([permisoDe('STEPS'), permisoDe('CALORIES')]);
  return otorgados.length > 0;
}

/** Abre los ajustes de Health Connect (administrar permisos, ver apps conectadas como Samsung Health). */
export function abrirHealthConnect(): void {
  try {
    openHealthConnectSettings();
  } catch {
    /* no-op: en dispositivos sin Health Connect no hay nada que abrir */
  }
}

export type EstadoHealthConnect = { disponible: boolean; conectado: boolean };

/** Estado para la UI: si HC existe y si dimos algún permiso de lectura (pasos o nutrición). */
export async function estadoHealthConnect(): Promise<EstadoHealthConnect> {
  if (!(await healthConnectDisponible())) return { disponible: false, conectado: false };
  if (!(await initialize())) return { disponible: true, conectado: false };
  const g = await getGrantedPermissions();
  return { disponible: true, conectado: tieneRecord(g, 'Steps') || tieneRecord(g, 'Nutrition') };
}

/** Pasos agregados de un día (yyyy-mm-dd). */
export async function leerPasosDeDia(fechaISO: string): Promise<number> {
  const res = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: rangoDia(fechaISO) });
  return res.COUNT_TOTAL ?? 0;
}

/** Una comida registrada en Health Connect (SnapCalorie, Samsung Health, etc.). */
export type ComidaHC = { nombre: string | null; kcal: number; mealType: number; hora: string };

/** Comidas de un día (yyyy-mm-dd): nombre + calorías + tipo de comida, ordenadas por hora. */
export async function leerComidasDeDia(fechaISO: string): Promise<ComidaHC[]> {
  const res = await readRecords('Nutrition', { timeRangeFilter: rangoDia(fechaISO) });
  return res.records
    .map((r) => ({
      nombre: r.name ?? null,
      kcal: Math.round(r.energy?.inKilocalories ?? 0),
      mealType: r.mealType ?? 0,
      hora: r.startTime,
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

/** Calorías totales de un día (suma de las comidas). */
export async function leerCaloriasDeDia(fechaISO: string): Promise<number> {
  const comidas = await leerComidasDeDia(fechaISO);
  return Math.round(comidas.reduce((s, c) => s + c.kcal, 0));
}
