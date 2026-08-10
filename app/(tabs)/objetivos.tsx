import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonMascot } from '@/components/DragonMascot';
import { ProfileButton } from '@/components/ProfileButton';
import { Card } from '@/components/ui/Card';
import { IconBadge } from '@/components/ui/IconBadge';
import { SpeechBubble } from '@/components/ui/SpeechBubble';
import { colors, spacing } from '@/constants/theme';

// MOCK — se reemplaza por datos reales (listarObjetivos / listarTareas) en las
// Fases 4 (Objetivos) y 5 (Tareas).
const HABITOS = [
  { id: '1', nombre: 'Ir al gym', frecuencia: 'Lunes, Martes, Jueves', icon: 'barbell-outline', bg: colors.purple100, fg: colors.purple },
  { id: '2', nombre: 'Clase Auditoría', frecuencia: 'Lunes', icon: 'book-outline', bg: colors.green100, fg: colors.green700 },
  { id: '3', nombre: 'Hacer equitación', frecuencia: 'Martes, Miércoles, Viernes', icon: 'paw-outline', bg: '#f3e6d3', fg: '#8a5a12' },
] as const;

const TAREAS = [{ id: 't1', titulo: 'TP1 Derecho', detalle: '10/8 entregar' }];

export default function ObjetivosScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topbar}>
        <ProfileButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flag-outline" size={22} color={colors.purple} />
            <Text style={styles.h1}>Objetivos</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <SpeechBubble>Definí, organizá y cumplí tus metas</SpeechBubble>
            <DragonMascot size={56} />
          </View>
        </View>

        <SectionHeader icon="refresh-outline" title="Hábitos recurrentes" />
        <View style={{ gap: 10 }}>
          {HABITOS.map((h) => (
            <Card key={h.id} style={styles.listRow}>
              <IconBadge name={h.icon} bg={h.bg} color={h.fg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{h.nombre}</Text>
                <Text style={styles.muted}>{h.frecuencia}</Text>
              </View>
              <Pressable style={styles.editBtn}>
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
            </Card>
          ))}
        </View>

        <SectionHeader icon="document-text-outline" title="Tareas" />
        {TAREAS.map((t) => (
          <Card key={t.id} style={styles.listRow}>
            <IconBadge name="document-text-outline" bg={colors.purple100} color={colors.purple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{t.titulo}</Text>
              <Text style={styles.muted}>{t.detalle}</Text>
            </View>
            <Pressable style={styles.editBtn}>
              <Text style={styles.editBtnText}>Editar</Text>
            </Pressable>
          </Card>
        ))}
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
  itemTitle: { fontSize: 14.5, color: colors.text },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  editBtnText: { fontSize: 13, fontWeight: '800', color: colors.text },
});
