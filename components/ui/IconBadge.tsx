import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

export function IconBadge({
  name,
  bg,
  color,
  size = 38,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  bg: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
