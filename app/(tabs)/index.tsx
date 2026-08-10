import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonMascot } from '@/components/DragonMascot';
import { ProfileButton } from '@/components/ProfileButton';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SpeechBubble } from '@/components/ui/SpeechBubble';
import { colors, spacing } from '@/constants/theme';

// MOCK — datos de ejemplo para ver el diseño. Se reemplazan por datos reales
// (RPC esperados_hoy + registro_objetivo) en la Fase 6 (pantalla Hoy).
const HOY_BOOLEANS = [
  { id: 'gym', nombre: 'Ir al gym', hora: '07:00', completado: true },
  { id: 'auditoria', nombre: 'Clase de auditoría', hora: '14:00', completado: false },
];

const RECORDA = [
  { id: 'agua', emoji: '💧', nombre: 'Tomar agua', label: '6/8 vasos', progress: 0.7 },
  { id: 'proteina', emoji: '🥗', nombre: 'Comer proteína', label: '2/3 comidas', progress: 0.66 },
  { id: 'pasos', emoji: '👟', nombre: 'Caminar 8.000 pasos', label: '6.240 / 8.000', progress: 0.78 },
];

export default function HoyScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(HOY_BOOLEANS.map((g) => [g.id, g.completado])),
  );
  const completedCount = Object.values(checked).filter(Boolean).length;
  const percent = Math.round((completedCount / HOY_BOOLEANS.length) * 100);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topbar}>
        <ProfileButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Recuadro principal (violeta) con el dragón asomando */}
        <Card style={styles.hero}>
          <Text style={[styles.h1, styles.heroText]}>Hola, Sofi 👋</Text>
          <Text style={[styles.muted, styles.heroText]}>Vas por buen camino ✨</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <ProgressBar progress={percent / 100} color={colors.purple} />
            </View>
            <Text style={styles.percentLabel}>{percent}%</Text>
          </View>
          <DragonMascot size={120} style={styles.heroDragon} />
        </Card>

        <SectionHeader icon="calendar-outline" title="Hoy" subtitle="Tus objetivos del día" />
        <Card>
          {HOY_BOOLEANS.map((goal, i) => (
            <Pressable
              key={goal.id}
              onPress={() => setChecked((c) => ({ ...c, [goal.id]: !c[goal.id] }))}
              style={[styles.checkline, i === HOY_BOOLEANS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.checkbox, checked[goal.id] && styles.checkboxDone]}>
                {checked[goal.id] && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.goalTitle, checked[goal.id] && styles.goalTitleDone]}>
                {goal.nombre}
              </Text>
              <Text style={styles.time}>{goal.hora}</Text>
              {checked[goal.id] ? (
                <View style={styles.doneCircle}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              )}
            </Pressable>
          ))}
        </Card>

        <SectionHeader
          icon="water-outline"
          iconColor={colors.blue}
          title="Recordá"
          subtitle="Pequeños hábitos, grandes cambios"
        />
        <Card style={{ paddingVertical: 4 }}>
          {RECORDA.map((item, i) => (
            <View
              key={item.id}
              style={[styles.recordaRow, i === RECORDA.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.recordaEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemLabel}>{item.nombre}</Text>
                  <Text style={styles.muted}>{item.label}</Text>
                </View>
                <ProgressBar progress={item.progress} color={colors.purple} />
              </View>
            </View>
          ))}
        </Card>

        {/* Recuadro "Mañana" (naranja) con dragón + globo */}
        <Card style={{ flexDirection: 'row', gap: 6, backgroundColor: colors.cardOrange }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={styles.mananaTitle}>Mañana entregar TP de auditoría</Text>
            <View style={styles.mananaChip}>
              <Ionicons name="calendar-outline" size={13} color={colors.orange} />
              <Text style={styles.mananaChipText}>Mañana</Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <SpeechBubble>¡Organizá hoy para ganar mañana! 💜</SpeechBubble>
            <DragonMascot size={72} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  iconColor = colors.text,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={styles.h2}>{title}</Text>
      </View>
      <Text style={[styles.muted, { marginLeft: 26, marginBottom: 10, marginTop: 2 }]}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: 8 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  hero: { backgroundColor: colors.cardPurple, overflow: 'visible' },
  heroText: { paddingRight: 104 },
  heroDragon: { position: 'absolute', right: -8, top: -22 },
  h1: { fontSize: 19, fontWeight: '800', color: colors.purple700, marginBottom: 2 },
  h2: { fontSize: 18, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  percentLabel: { fontSize: 12, fontWeight: '800', color: colors.purple700 },
  itemLabel: { fontSize: 13.5, color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  checkline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d8d3ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { borderColor: colors.purple, backgroundColor: colors.purple },
  goalTitle: { flex: 1, fontSize: 14.5, color: colors.text },
  goalTitleDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  doneCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recordaEmoji: { fontSize: 24, width: 30, textAlign: 'center' },
  mananaTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  mananaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  mananaChipText: { color: colors.orange, fontWeight: '800', fontSize: 12.5 },
});
