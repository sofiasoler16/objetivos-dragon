import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { type Tema } from '@/constants/theme';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';

/** Botón arriba a la izquierda — muestra la cara del dragón equipado y abre "Mi Dragón". */
export function DragonButton() {
  const assetKey = useDragonEquipado();
  const styles = makeStyles(useTheme());
  return (
    <Link href="/mi-dragon" asChild>
      <Pressable style={styles.btn} hitSlop={8}>
        <DragonMascot assetKey={assetKey} size={34} />
      </Pressable>
    </Link>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    btn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.purple100,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
