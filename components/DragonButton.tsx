import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { type Tema } from '@/constants/theme';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';

/**
 * Botón arriba a la izquierda: cara del dragón equipado + texto "Mis dragones"
 * (para que se lea claramente como botón apretable). Abre la pantalla "Mi Dragón".
 */
export function DragonButton() {
  const assetKey = useDragonEquipado();
  const colors = useTheme();
  const styles = makeStyles(colors);
  return (
    <Link href="/mi-dragon" asChild>
      <Pressable style={styles.btn} hitSlop={8}>
        <View style={styles.face}>
          <DragonMascot assetKey={assetKey} size={30} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          Mis dragones
        </Text>
      </Pressable>
    </Link>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    btn: {
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: colors.purple100,
    },
    face: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    label: { fontSize: 9.5, fontWeight: '800', color: colors.purple700 },
  });
