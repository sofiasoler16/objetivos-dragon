import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, type Tema } from '@/constants/theme';

export function ProgressBar({
  progress,
  color,
}: {
  /** 0..1 */
  progress: number;
  color?: string;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color ?? colors.accent }]} />
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
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
