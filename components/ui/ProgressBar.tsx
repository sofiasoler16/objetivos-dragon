import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function ProgressBar({
  progress,
  color = colors.accent,
}: {
  /** 0..1 */
  progress: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral200,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
