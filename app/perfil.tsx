import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/components/session-provider';
import { Card } from '@/components/ui/Card';
import { colors, spacing } from '@/constants/theme';
import { cerrarSesion } from '@/lib/data';

const OPTIONS = [
  { id: 'categorias', label: 'Categorías', icon: 'pricetags-outline', route: '/categorias' },
  { id: 'notif', label: 'Notificaciones', icon: 'notifications-outline' },
  { id: 'ayuda', label: 'Ayuda y soporte', icon: 'help-circle-outline' },
] as const;

export default function PerfilScreen() {
  const { session } = useSession();
  const email = session?.user.email ?? '';
  const nombre = (session?.user.user_metadata?.nombre as string) || email.split('@')[0] || 'Vos';
  const inicial = (nombre[0] ?? 'V').toUpperCase();

  async function onLogout() {
    // Al cerrar sesión, el guard de rutas redirige solo a /login.
    await cerrarSesion();
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.h1}>Perfil</Text>
          <View style={{ width: 22 }} />
        </View>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.cardPurple }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{inicial}</Text>
          </View>
          <View>
            <Text style={styles.name}>{nombre}</Text>
            <Text style={styles.muted}>{email}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Tu plan</Text>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.muted}>Plan actual</Text>
            <Text style={styles.planValue}>Gratis</Text>
          </View>
          <Pressable style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Mejorar a Premium</Text>
          </Pressable>
        </Card>

        <Card style={{ paddingVertical: 4, paddingHorizontal: 18 }}>
          {OPTIONS.map((o, i) => (
            <Pressable
              key={o.id}
              onPress={() => {
                if ('route' in o) router.push(o.route);
              }}
              style={[styles.listRow, i === OPTIONS.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name={o.icon} size={18} color={colors.purple} />
              <Text style={styles.listLabel}>{o.label}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  h1: { fontSize: 20, fontWeight: '800', color: colors.text },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  name: { fontWeight: '800', fontSize: 16, color: colors.purple700 },
  muted: { fontSize: 12.5, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  planValue: { fontWeight: '800', fontSize: 15, color: colors.text, marginTop: 2 },
  upgradeBtn: { backgroundColor: colors.purple, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  upgradeBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  listLabel: { flex: 1, fontSize: 14, color: colors.text },
  logoutBtn: { borderWidth: 1, borderColor: colors.redBorder, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  logoutText: { color: colors.red, fontWeight: '800', fontSize: 14 },
});
