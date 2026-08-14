import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reiniciarOnboarding } from '@/components/Onboarding';
import { useSession } from '@/components/session-provider';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import { cerrarSesion } from '@/lib/data';
import {
  abrirHealthConnect,
  conectarHealthConnect,
  type EstadoHealthConnect,
  estadoHealthConnect,
} from '@/lib/health';
import { notificacionDePrueba } from '@/lib/notificaciones';

const OPTIONS = [
  { id: 'categorias', label: 'Categorías', icon: 'pricetags-outline', route: '/categorias' },
  { id: 'notif', label: 'Probar recordatorio', icon: 'notifications-outline' },
  { id: 'tutorial', label: 'Ver tutorial de nuevo', icon: 'help-circle-outline' },
] as const;

export default function PerfilScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { session } = useSession();
  const email = session?.user.email ?? '';
  const nombre = (session?.user.user_metadata?.nombre as string) || email.split('@')[0] || 'Vos';
  const inicial = (nombre[0] ?? 'V').toUpperCase();

  async function onLogout() {
    // Al cerrar sesión, el guard de rutas redirige solo a /login.
    await cerrarSesion();
  }

  async function onProbarNotificacion() {
    const ok = await notificacionDePrueba();
    Alert.alert(
      ok ? 'Notificación de prueba enviada' : 'Permiso denegado',
      ok
        ? 'Debería llegarte en unos segundos 🐉'
        : 'Activá las notificaciones en los ajustes del teléfono para recibir recordatorios.',
    );
  }

  async function onVerTutorial() {
    await reiniciarOnboarding();
    Alert.alert('Tutorial reactivado', 'La próxima vez que abras la app vas a ver el tutorial.');
  }

  // Health Connect: estado del permiso de pasos (para la sección Permisos).
  const [hc, setHc] = useState<EstadoHealthConnect | null>(null);
  const refrescarHC = useCallback(() => {
    estadoHealthConnect()
      .then(setHc)
      .catch(() => setHc({ disponible: false, conectado: false }));
  }, []);
  useEffect(() => {
    refrescarHC();
  }, [refrescarHC]);

  async function onConectarHC() {
    const ok = await conectarHealthConnect();
    refrescarHC();
    if (!ok)
      Alert.alert(
        'No se pudo conectar',
        'Permití el acceso en Health Connect (pasos y/o nutrición). Si no aparece el diálogo, revisá que Health Connect esté disponible en tu teléfono.',
      );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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
                if (o.id === 'notif') return void onProbarNotificacion();
                if (o.id === 'tutorial') return void onVerTutorial();
                if ('route' in o) router.push(o.route);
              }}
              style={[styles.listRow, i === OPTIONS.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name={o.icon} size={18} color={colors.purple} />
              <Text style={styles.listLabel}>{o.label}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>Permisos</Text>
        <Card style={{ gap: 12 }}>
          <View style={styles.hcRow}>
            <Ionicons name="walk-outline" size={20} color={colors.purple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listLabel}>Health Connect · pasos y calorías</Text>
              <Text style={styles.muted}>
                {hc == null
                  ? 'Verificando…'
                  : !hc.disponible
                    ? 'No disponible en este teléfono'
                    : hc.conectado
                      ? 'Conectado ✓'
                      : 'No conectado'}
              </Text>
            </View>
            {hc?.disponible && !hc.conectado && (
              <Pressable style={styles.hcBtn} onPress={onConectarHC}>
                <Text style={styles.hcBtnText}>Conectar</Text>
              </Pressable>
            )}
            {hc?.conectado && (
              <Pressable style={styles.hcBtnGhost} onPress={abrirHealthConnect}>
                <Text style={styles.hcBtnGhostText}>Administrar</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.muted}>
            Conectá Health Connect para traer tus pasos solos. Para que haya datos, Samsung Health (u
            otra app de actividad) tiene que compartir tus pasos con Health Connect.
          </Text>
        </Card>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
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
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hcBtn: { backgroundColor: colors.purple, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  hcBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  hcBtnGhost: { backgroundColor: colors.purple100, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  hcBtnGhostText: { color: colors.purple, fontWeight: '800', fontSize: 12.5 },
  logoutBtn: { borderWidth: 1, borderColor: colors.redBorder, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  logoutText: { color: colors.red, fontWeight: '800', fontSize: 14 },
});
