import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, type Tema } from '@/constants/theme';

/**
 * Globo de diálogo estilo cómic — acompaña al <DragonMascot> cuando el dragón "habla".
 * `tail` = hacia dónde apunta la colita: 'bottom' (dragón debajo) o 'right' (dragón al lado).
 */
export function SpeechBubble({
  children,
  maxWidth = 150,
  tail = 'bottom',
}: {
  children: string;
  maxWidth?: number;
  tail?: 'bottom' | 'right';
}) {
  const styles = makeStyles(useTheme());
  if (tail === 'right') {
    return (
      <View style={{ maxWidth, flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.bubble}>
          <Text style={styles.text}>{children}</Text>
        </View>
        <View style={styles.tailRight} />
      </View>
    );
  }
  return (
    <View style={{ maxWidth }}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{children}</Text>
      </View>
      <View style={styles.tailBottom} />
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
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
    // Colita apuntando hacia abajo (dragón debajo del globo).
    tailBottom: {
      width: 12,
      height: 12,
      backgroundColor: colors.card,
      alignSelf: 'flex-end',
      marginRight: 22,
      marginTop: -6,
      transform: [{ rotate: '45deg' }],
    },
    // Colita apuntando hacia la derecha (dragón al costado del globo).
    tailRight: {
      width: 12,
      height: 12,
      backgroundColor: colors.card,
      marginLeft: -6,
      transform: [{ rotate: '45deg' }],
    },
  });
