import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Distintivo de feature/dragón Premium: coronita 👑 (marca que es premium) y, si está
 * bloqueado para el usuario, además un candadito 🔒. `tone="light"` para fondos oscuros
 * (ej. la card violeta de Mi semana); `style` permite posicionarlo (absoluto, etc.).
 */
export function PremiumBadge({
  bloqueado,
  tone = 'default',
  style,
}: {
  bloqueado: boolean;
  tone?: 'default' | 'light';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, tone === 'light' ? styles.light : styles.dark, style]}>
      {bloqueado && <Text style={styles.emoji}>🔒</Text>}
      <Text style={styles.emoji}>👑</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  light: { backgroundColor: 'rgba(255,255,255,0.22)' },
  dark: { backgroundColor: 'rgba(0,0,0,0.05)' },
  emoji: { fontSize: 12 },
});
