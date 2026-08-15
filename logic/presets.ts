/**
 * Catálogo de objetivos PREDETERMINADOS (presets) — lógica pura, sin UI ni Supabase.
 *
 * Un preset es un objetivo diario NUMERIC que el usuario puede activar con un
 * interruptor (en vez de crearlo a mano). Una vez activo es un objetivo común:
 * se edita (meta, días, etc.) y se puede conectar a Health Connect igual que
 * cualquier otro. Desactivar lo oculta guardando sus ediciones.
 */

export type ClavePreset = 'pasos' | 'calorias' | 'agua';

export type Preset = {
  clave: ClavePreset;
  nombre: string;
  icono: string;
  /** Frase corta para la tarjeta cuando está apagado. */
  descripcion: string;
  meta_valor: number;
  unidad: string;
  /** Los que Health Connect puede llenar solos arrancan en HEALTH_CONNECT. */
  fuente_datos: 'MANUAL' | 'HEALTH_CONNECT';
};

/** Orden en que se muestran en "Sugeridos". */
export const PRESETS: Preset[] = [
  {
    clave: 'pasos',
    nombre: 'Pasos',
    icono: '👟',
    descripcion: 'Caminá todos los días. Se llena solo con Health Connect.',
    meta_valor: 8000,
    unidad: 'pasos',
    fuente_datos: 'HEALTH_CONNECT',
  },
  {
    clave: 'calorias',
    nombre: 'Calorías',
    icono: '🍎',
    descripcion: 'Registrá lo que comés. Se llena solo con Health Connect.',
    meta_valor: 2000,
    unidad: 'kcal',
    fuente_datos: 'HEALTH_CONNECT',
  },
  {
    clave: 'agua',
    nombre: 'Agua',
    icono: '💧',
    descripcion: 'Tomá suficiente agua durante el día.',
    meta_valor: 2000,
    unidad: 'ml',
    fuente_datos: 'MANUAL',
  },
];

export function presetPorClave(clave: ClavePreset): Preset {
  const p = PRESETS.find((x) => x.clave === clave);
  if (!p) throw new Error(`Preset desconocido: ${clave}`);
  return p;
}

/** Devuelve la clave de preset de un objetivo (o null si es común). Tolerante a tipos no regenerados. */
export function clavePresetDe(objetivo: unknown): ClavePreset | null {
  const v = (objetivo as { clave_preset?: string | null } | null | undefined)?.clave_preset;
  return v === 'pasos' || v === 'calorias' || v === 'agua' ? v : null;
}
