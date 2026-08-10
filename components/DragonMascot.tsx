import { Image, type ImageProps } from 'react-native';
import { dragonSource } from '@/constants/dragons';

/**
 * La mascota dragón. Por defecto muestra el Original; cuando exista el sistema
 * de temas (V3), se le pasa el `assetKey` del dragón equipado
 * (preferencia_usuario → dragon.asset_key) y cambia el arte solo.
 */
export function DragonMascot({
  size = 56,
  assetKey,
  style,
}: { size?: number; assetKey?: string } & Pick<ImageProps, 'style'>) {
  return (
    <Image
      source={dragonSource(assetKey)}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
