import { Image, type ImageProps } from 'react-native';
import { dragonSource, type ExpresionDragon } from '@/constants/dragons';

/**
 * La mascota dragón. Sin `expresion` muestra el busto neutral (Objetivos, Progreso,
 * login). Con `expresion` (Hoy) cambia la cara según el estado del día. Cuando exista
 * el sistema de temas (V3) se le pasa el `assetKey` del dragón equipado y cambia el set.
 */
export function DragonMascot({
  size = 56,
  assetKey,
  expresion,
  style,
}: { size?: number; assetKey?: string; expresion?: ExpresionDragon } & Pick<ImageProps, 'style'>) {
  return (
    <Image
      source={dragonSource(assetKey, expresion)}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
