import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, type Tema } from '@/constants/theme';
import { obtenerPerfilStats } from '@/lib/data';
import { nivelDesdeXp, xpEnNivel } from '@/logic/dragones';

/** Barra superior: nivel · XP (dentro del nivel) · monedas. Siempre visible. Abre Mi Dragón. */
export function StatsPills() {
  const { data } = useQuery({ queryKey: ['perfil-stats'], queryFn: obtenerPerfilStats });
  const styles = makeStyles(useTheme());
  const xpTotal = data?.xp_total ?? 0;
  const monedas = data?.creditos ?? 0;
  const nivel = nivelDesdeXp(xpTotal);
  const xp = xpEnNivel(xpTotal);
  return (
    <Link href="/mi-dragon" asChild>
      <Pressable style={styles.row} hitSlop={6}>
        <View style={styles.nivel}>
          <Text style={styles.nivelNum}>{nivel}</Text>
          <Text style={styles.nivelLbl}>Nivel</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.txt}>⚡ {xp} XP</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.txt}>🪙 {monedas}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nivel: { alignItems: 'center', minWidth: 22 },
    nivelNum: { fontSize: 15, fontWeight: '800', color: colors.purple700, lineHeight: 16 },
    nivelLbl: {
      fontSize: 8,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    pill: {
      backgroundColor: colors.purple100,
      borderRadius: radius.pill,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    txt: { fontSize: 12.5, fontWeight: '800', color: colors.purple700 },
  });
