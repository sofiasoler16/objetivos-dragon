import { Image, StyleSheet, View, type ViewProps } from 'react-native';
import { DEFAULT_DRAGON_KEY, DRAGON_ART } from '@/constants/dragons';
import type { EstadoDragon } from '@/logic/dragon';

// Orden de las expresiones que se apilan en el hero de Hoy.
const EXPRESIONES: EstadoDragon[] = ['manana', 'animo', 'orgullo', 'festejo', 'enojado'];

// Dragones con arte YA normalizado (todas las expresiones del mismo tamaño): no necesitan
// el ajuste por expresión; solo un escalado parejo para llenar la caja del hero.
const NORMALIZADOS = new Set([
  'dragon_medieval',
  'dragon_princesa_medieval',
  'dragon_mago',
  'dragon_gimnasio',
  'dragon_arcoiris',
  'dragon_programador',
  'dragon_samurai',
]);
// Para el resto (Original/Fuego/…): `festejo` es más cuadrada → se agranda para verse pareja.
function escalaExpresion(assetKey: string, e: EstadoDragon): number {
  if (NORMALIZADOS.has(assetKey)) return 1.3;
  return e === 'festejo' ? 1.35 : 1;
}

/**
 * Dragón del recuadro principal (Hoy). Renderiza las 5 expresiones APILADAS y solo
 * muestra la activa (opacidad) → cambiar de ánimo es instantáneo, sin recargar la
 * imagen (nada de parpadeo/"blanco" al cambiar). Cuerpo entero: sobresale por arriba.
 */
export function DragonHero({
  estado,
  assetKey,
  width = 104,
  height = 150,
  style,
}: {
  estado: EstadoDragon;
  assetKey?: string;
  width?: number;
  height?: number;
} & Pick<ViewProps, 'style'>) {
  const key = assetKey ?? DEFAULT_DRAGON_KEY;
  const set = DRAGON_ART[key] ?? DRAGON_ART[DEFAULT_DRAGON_KEY];
  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      {EXPRESIONES.map((e) => (
        <Image
          key={e}
          source={set[e]}
          resizeMode="contain"
          fadeDuration={0}
          style={[
            StyleSheet.absoluteFill,
            { width, height, opacity: e === estado ? 1 : 0, transform: [{ scale: escalaExpresion(key, e) }] },
          ]}
        />
      ))}
    </View>
  );
}
