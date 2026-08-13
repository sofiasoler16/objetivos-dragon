import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, shadow, spacing, type Tema } from '@/constants/theme';

export function Card({ style, ...props }: ViewProps) {
  const styles = makeStyles(useTheme());
  return <View style={[styles.card, shadow.sm, style]} {...props} />;
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
  });
