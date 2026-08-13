import { Pressable, StyleSheet, Text } from 'react-native';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { radius, spacing, type Tema } from '@/constants/theme';

/**
 * Estado "sin datos" reutilizable: vacío (con dragón que invita a la acción) o error
 * (con botón Reintentar). Evita pantallas en blanco. Loading se maneja aparte (spinner).
 */
export function EstadoMensaje({
  titulo,
  subtitulo,
  onReintentar,
  conDragon = false,
}: {
  titulo: string;
  subtitulo?: string;
  onReintentar?: () => void;
  conDragon?: boolean;
}) {
  const styles = makeStyles(useTheme());
  return (
    <Card style={styles.card}>
      {conDragon && <DragonMascot size={72} />}
      <Text style={styles.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={styles.sub}>{subtitulo}</Text> : null}
      {onReintentar ? (
        <Pressable style={styles.btn} onPress={onReintentar}>
          <Text style={styles.btnText}>Reintentar</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    card: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
    titulo: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },
    sub: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
    btn: {
      marginTop: 6,
      backgroundColor: colors.purple,
      borderRadius: radius.pill,
      paddingVertical: 9,
      paddingHorizontal: 22,
    },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  });
