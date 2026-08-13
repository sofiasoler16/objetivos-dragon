import { Image, StyleSheet, View, type ViewProps } from 'react-native';
import { DEFAULT_DRAGON_KEY, DRAGON_ART } from '@/constants/dragons';
import type { EstadoDragon } from '@/logic/dragon';

// Orden de las expresiones que se apilan en el hero de Hoy.
const EXPRESIONES: EstadoDragon[] = ['manana', 'animo', 'orgullo', 'festejo', 'enojado'];

// Ajuste de tamaño por expresión: `festejo` es cuadrada (las otras verticales), así
// que en la caja vertical queda más chica → la agrandamos para que se vea pareja.
const ESCALA: Partial<Record<EstadoDragon, number>> = { festejo: 1.35 };

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
  const set = DRAGON_ART[assetKey ?? DEFAULT_DRAGON_KEY] ?? DRAGON_ART[DEFAULT_DRAGON_KEY];
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
            { width, height, opacity: e === estado ? 1 : 0, transform: [{ scale: ESCALA[e] ?? 1 }] },
          ]}
        />
      ))}
    </View>
  );
}
