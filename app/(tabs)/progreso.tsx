import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonMascot } from '@/components/DragonMascot';
import { ProfileButton } from '@/components/ProfileButton';
import { Card } from '@/components/ui/Card';
import { IconBadge } from '@/components/ui/IconBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SpeechBubble } from '@/components/ui/SpeechBubble';
import { colors, spacing } from '@/constants/theme';

// MOCK — se reemplaza por datos reales calculados desde registro_objetivo
// (vistas/funciones SQL) en la Fase 8 (Progreso).
const SEMANAL = [
  { id: 'fitness', nombre: 'Fitness', progress: 0.8, icon: 'barbell-outline', bg: colors.purple100, fg: colors.purple, bar: colors.purple },
  { id: 'universidad', nombre: 'Universidad', progress: 1, icon: 'school-outline', bg: colors.green100, fg: colors.green700, bar: colors.green },
  { id: 'personal', nombre: 'Personal', progress: 0.7, icon: 'person-outline', bg: colors.blue100, fg: colors.blue700, bar: colors.blue },
] as const;

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DONE_DAYS = new Set([1, 2, 3, 4, 5, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 27, 28, 29, 30, 31]);

export default function ProgresoScreen() {
  const cells = useMemo(() => {
    const c: { label: string; done?: boolean }[] = [{ label: '' }, { label: '' }];
    for (let d = 1; d <= 31; d++) c.push({ label: String(d), done: DONE_DAYS.has(d) });
    while (c.length % 7 !== 0) c.push({ label: '' });
    return c;
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topbar}>
        <ProfileButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="stats-chart-outline" size={22} color={colors.purple} />
            <Text style={styles.h1}>Progreso</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <SpeechBubble>¡Vas increíble! Seguí así 💚</SpeechBubble>
            <DragonMascot size={56} />
          </View>
        </View>

        <SectionHeader icon="calendar-outline" title="Semanal" />
        <Card style={{ gap: spacing.lg }}>
          {SEMANAL.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', gap: 12 }}>
              <IconBadge name={s.icon} bg={s.bg} color={s.fg} size={34} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{s.nombre}</Text>
                  <Text style={styles.muted}>{Math.round(s.progress * 100)}%</Text>
                </View>
                <ProgressBar progress={s.progress} color={s.bar} />
              </View>
            </View>
          ))}
        </Card>

        <SectionHeader icon="calendar-outline" title="Mes" />
        <Card>
          <View style={styles.calHeader}>
            <Pressable hitSlop={8}>
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </Pressable>
            <Text style={styles.calMonth}>Mayo</Text>
            <Pressable hitSlop={8}>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.calGrid}>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={styles.calDayLabel}>
                {d}
              </Text>
            ))}
            {cells.map((c, i) => (
              <View key={i} style={[styles.calCell, c.done && { backgroundColor: colors.green }]}>
                {c.label !== '' && (
                  <Text style={[styles.calCellText, c.done && { color: '#fff' }]}>
                    {c.done ? '✓' : c.label}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      }}>
      <Ionicons name={icon} size={18} color={colors.purple} />
      <Text style={styles.h2}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: 8 },
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  itemTitle: { fontSize: 13.5, color: colors.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calMonth: { fontSize: 14, fontWeight: '800', color: colors.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, color: colors.textMuted, marginBottom: 6 },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    marginBottom: 4,
    backgroundColor: '#f3f1fa',
  },
  calCellText: { fontSize: 10.5, color: colors.textMuted },
});
