import type { ImageSourcePropType } from 'react-native';

// Registro de arte de dragones.
// React Native necesita require() ESTÁTICOS (no se puede require(variable)),
// así que cada dragón se declara acá con una línea. La clave es el `asset_key`
// de la tabla `dragon` en la base → así, equipar un dragón elige su imagen.
//
// Para sumar un dragón nuevo:
//   1) creá la carpeta  assets/dragons/<nombre>/
//   2) poné su arte      dragon.png  (y luego expresiones por estado, Fase 9)
//   3) agregá una línea acá con su asset_key
//   4) insertá la fila en `dragon` (+ su `tema`) en la base
export const DRAGON_ASSETS: Record<string, ImageSourcePropType> = {
  dragon_original: require('../assets/dragons/original/dragon.png'),
};

export const DEFAULT_DRAGON_KEY = 'dragon_original';

/** Devuelve el arte del dragón por su asset_key; cae al Original si no existe. */
export function dragonSource(assetKey?: string): ImageSourcePropType {
  return DRAGON_ASSETS[assetKey ?? DEFAULT_DRAGON_KEY] ?? DRAGON_ASSETS[DEFAULT_DRAGON_KEY];
}
