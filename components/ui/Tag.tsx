import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/constants/theme';

export function Tag({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'accent2' }) {
  const bg = tone === 'accent' ? colors.accent100 : colors.accent2_100;
  const fg = tone === 'accent' ? colors.accent700 : colors.accent2_700;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily: fonts.bodySemibold, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.md * 0.75,
  },
});
