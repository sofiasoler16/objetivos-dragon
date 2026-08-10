import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

/** Globo de diálogo estilo cómic — acompaña al <DragonMascot> cuando el dragón "habla". */
export function SpeechBubble({
  children,
  maxWidth = 150,
}: {
  children: string;
  maxWidth?: number;
}) {
  return (
    <View style={{ maxWidth }}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{children}</Text>
      </View>
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { fontSize: 12.5, lineHeight: 17, color: colors.text },
  tail: {
    width: 12,
    height: 12,
    backgroundColor: colors.card,
    alignSelf: 'flex-end',
    marginRight: 22,
    marginTop: -6,
    transform: [{ rotate: '45deg' }],
  },
});
