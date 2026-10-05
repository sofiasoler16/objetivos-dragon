import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mostrarOnboarding } from '@/components/Onboarding';
import { useSession } from '@/components/session-provider';
import { useTheme } from '@/components/theme-provider';
import { usePremium } from '@/hooks/usePremium';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import {
  cambiarPassword,
  cerrarSesion,
  conectarGoogleCalendar,
  conectarTelefono,
  desconectarGoogle,
  desconectarTelefono,
  eliminarCuenta,
  googleConectado,
  googleConfigurado,
  repararEspejosCalendario,
  sincronizarObjetivosSinEspejo,
  telefonoConectado,
} from '@/lib/data';
import {
  abrirHealthConnect,
  conectarHealthConnect,
  type EstadoHealthConnect,
  estadoHealthConnect,
} from '@/lib/health';
import { abrirAjustesBateria } from '@/lib/notificaciones';
import { exportarDatos, restaurarDatos } from '@/lib/data';
import { elegirArchivoJson, exportarArchivo } from '@/lib/backup';
import { useQueryClient } from '@tanstack/react-query';

const POLITICA_URL = 'https://drakostone.solersofia.com/';

const OPTIONS = [
  { id: 'resenas', label: 'Reseñas y comentarios', icon: 'chatbubble-ellipses-outline' },
  { id: 'bateria', label: '¿Notificaciones no llegan a tiempo?', icon: 'battery-charging-outline' },
  { id: 'exportar', label: 'Exportar mis datos (backup .json)', icon: 'download-outline' },
  { id: 'importar', label: 'Restaurar desde un backup', icon: 'cloud-upload-outline' },
  { id: 'tutorial', label: 'Ver tutorial de nuevo', icon: 'help-circle-outline' },
] as const;

export default function PerfilScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { esPremium } = usePremium();
  const email = session?.user.email ?? '';
  const nombre = (session?.user.user_metadata?.nombre as string) || email.split('@')[0] || 'Vos';
  const inicial = (nombre[0] ?? 'V').toUpperCase();

  const [eliminando, setEliminando] = useState(false);

  // Cambiar contraseña (usuario logueado).
  const [mostrarCambioPass, setMostrarCambioPass] = useState(false);
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmarPass, setConfirmarPass] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);
  async function onCambiarPass() {
    if (nuevaPass.length < 6) return Alert.alert('Contraseña muy corta', 'Tiene que tener al menos 6 caracteres.');
    if (nuevaPass !== confirmarPass) return Alert.alert('No coinciden', 'La contraseña y su confirmación no coinciden.');
    setGuardandoPass(true);
    try {
      await cambiarPassword(nuevaPass);
      setNuevaPass('');
      setConfirmarPass('');
      setMostrarCambioPass(false);
      Alert.alert('Listo', 'Tu contraseña se actualizó.');
    } catch (e) {
      Alert.alert('No se pudo cambiar', e instanceof Error ? e.message : 'Intentá de nuevo.');
    } finally {
      setGuardandoPass(false);
    }
  }

  async function onLogout() {
    // Al cerrar sesión, el guard de rutas redirige solo a /login.
    await cerrarSesion();
  }

  function onEliminarCuenta() {
    Alert.alert(
      'Eliminar cuenta',
      'Esto borra tu cuenta y TODOS tus datos (objetivos, tareas, progreso, dragones, monedas) de forma permanente. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setEliminando(true);
            try {
              await eliminarCuenta();
              // Al quedar sin sesión, el guard de rutas redirige solo a /login.
            } catch (e) {
              setEliminando(false);
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
            }
          },
        },
      ],
    );
  }


  function onAjustesBateria() {
    Alert.alert(
      'Para que los recordatorios lleguen a tiempo',
      'Android puede retrasar los avisos para ahorrar batería. En la lista que se abre, buscá Drakostone y ponela en "Sin restricciones" / "No optimizar".',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir ajustes', onPress: () => void abrirAjustesBateria() },
      ],
    );
  }

  async function onExportar() {
    try {
      const datos = await exportarDatos();
      const nombre = `drakostone-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const ok = await exportarArchivo(JSON.stringify(datos), nombre);
      if (!ok) Alert.alert('No se pudo exportar', 'Disponible tras actualizar la app a la última versión.');
    } catch {
      Alert.alert('No se pudo exportar', 'Intentá de nuevo en un momento.');
    }
  }

  function onImportar() {
    Alert.alert(
      'Restaurar desde un backup',
      'Elegí un archivo .json que hayas exportado. Se agregan/actualizan tus objetivos, tareas y progreso desde ese backup.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir archivo',
          onPress: async () => {
            const contenido = await elegirArchivoJson();
            if (!contenido) return; // canceló o no disponible
            let datos: unknown;
            try {
              datos = JSON.parse(contenido);
            } catch {
              return Alert.alert('Archivo inválido', 'Ese archivo no es un backup válido.');
            }
            try {
              const r = await restaurarDatos(datos as any);
              queryClient.invalidateQueries();
              Alert.alert(
                'Backup restaurado ✓',
                `${r.objetivos} objetivos, ${r.tareas} tareas y ${r.registros} registros.`,
              );
            } catch (e: any) {
              // Mostramos el motivo REAL (mensaje del Error envuelto, o cualquier .message/.details
              // que traiga el objeto), para poder diagnosticar en vez del genérico "Intentá de nuevo".
              const motivo = e?.message ?? e?.details ?? (typeof e === 'string' ? e : null);
              Alert.alert('No se pudo restaurar', motivo || 'Intentá de nuevo en un momento.');
            }
          },
        },
      ],
    );
  }

  function onVerTutorial() {
    router.back(); // cerrar Perfil para que el tutorial quede visible sobre las pestañas
    setTimeout(() => mostrarOnboarding(), 250);
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

  // Google Calendar: estado de la conexión (para agendar los objetivos con color real).
  const [google, setGoogle] = useState<boolean | null>(null);
  const refrescarGoogle = useCallback(() => {
    googleConectado()
      .then(setGoogle)
      .catch(() => setGoogle(false));
  }, []);
  useEffect(() => {
    refrescarGoogle();
  }, [refrescarGoogle]);

  async function onConectarGoogle() {
    const ok = await conectarGoogleCalendar();
    if (ok) await sincronizarObjetivosSinEspejo().catch(() => {}); // re-espeja los que faltaban (1.c)
    refrescarGoogle();
    if (!ok)
      Alert.alert(
        'No se pudo conectar',
        'Iniciá sesión con tu cuenta de Google y aceptá el permiso de calendario. Si dice que la app no está verificada, tu correo tiene que estar en la lista de usuarios de prueba.',
      );
  }

  function onDesconectarGoogle() {
    Alert.alert('Desconectar Google Calendar', 'Tus objetivos con horario volverán a agendarse en el calendario del teléfono. Los eventos ya creados en Google no se borran.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          await desconectarGoogle();
          refrescarGoogle();
        },
      },
    ]);
  }

  // Reparar duplicados: borra TODOS los eventos 🐉 de cada objetivo y crea uno solo.
  const [reparando, setReparando] = useState(false);
  function onRepararCalendario() {
    Alert.alert(
      'Reparar eventos duplicados',
      'Voy a borrar los eventos de tus objetivos en el calendario y crear uno solo de cada uno (limpia los duplicados). Tus objetivos de la app no se tocan. ¿Seguimos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reparar',
          onPress: async () => {
            setReparando(true);
            try {
              const n = await repararEspejosCalendario();
              Alert.alert('Listo', `Reparé ${n} objetivo${n === 1 ? '' : 's'}. Revisá tu calendario: cada uno debería quedar una sola vez.`);
            } catch {
              Alert.alert('No se pudo', 'Intentá de nuevo en un momento.');
            } finally {
              setReparando(false);
            }
          },
        },
      ],
    );
  }

  // Calendario del teléfono: conectar/desconectar (preferencia local; el permiso del SO se mantiene).
  const [tel, setTel] = useState<boolean | null>(null);
  const refrescarTel = useCallback(() => {
    telefonoConectado()
      .then(setTel)
      .catch(() => setTel(false));
  }, []);
  useEffect(() => {
    refrescarTel();
  }, [refrescarTel]);

  async function onConectarTel() {
    const ok = await conectarTelefono();
    if (ok) await sincronizarObjetivosSinEspejo().catch(() => {}); // re-espeja los que faltaban (1.c)
    refrescarTel();
    if (!ok)
      Alert.alert(
        'Permiso denegado',
        'Activá el acceso al calendario en los ajustes del teléfono para ver tus eventos en Mi semana.',
      );
  }

  function onDesconectarTel() {
    Alert.alert(
      'Desconectar calendario del teléfono',
      'La app dejará de leer los eventos del calendario del teléfono en Mi semana. El permiso del sistema queda igual; podés volver a conectarlo cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await desconectarTelefono();
            refrescarTel();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
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

        <Text style={styles.sectionTitle}>Cuenta</Text>
        <Card style={{ gap: 12 }}>
          {!mostrarCambioPass ? (
            <Pressable style={styles.filaAccion} onPress={() => setMostrarCambioPass(true)}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.purple} />
              <Text style={styles.filaAccionText}>Cambiar contraseña</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <>
              <View style={styles.passRow}>
                <TextInput
                  style={styles.passInput}
                  placeholder="Nueva contraseña"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!verPass}
                  value={nuevaPass}
                  onChangeText={setNuevaPass}
                />
                <Pressable hitSlop={8} onPress={() => setVerPass((v) => !v)}>
                  <Ionicons name={verPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <TextInput
                style={styles.passInputSolo}
                placeholder="Repetir la nueva contraseña"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!verPass}
                value={confirmarPass}
                onChangeText={setConfirmarPass}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  style={[styles.hcBtnGhost, { flex: 1, alignItems: 'center' }]}
                  onPress={() => {
                    setMostrarCambioPass(false);
                    setNuevaPass('');
                    setConfirmarPass('');
                  }}>
                  <Text style={styles.hcBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.hcBtn, { flex: 1, alignItems: 'center' }, guardandoPass && { opacity: 0.6 }]}
                  onPress={onCambiarPass}
                  disabled={guardandoPass}>
                  <Text style={styles.hcBtnText}>{guardandoPass ? 'Guardando…' : 'Guardar'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Card>

        <Text style={styles.sectionTitle}>Tu plan</Text>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.muted}>Plan actual</Text>
            <Text style={styles.planValue}>{esPremium ? 'Premium 👑' : 'Gratis'}</Text>
          </View>
          <Pressable style={styles.upgradeBtn} onPress={() => router.push('/premium')}>
            <Text style={styles.upgradeBtnText}>{esPremium ? 'Gestionar' : 'Mejorar a Premium'}</Text>
          </Pressable>
        </Card>

        <Card style={{ paddingVertical: 4, paddingHorizontal: 18 }}>
          {OPTIONS.map((o, i) => (
            <Pressable
              key={o.id}
              onPress={() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ruta nueva; los tipos de expo-router se regeneran al correr la app
                if (o.id === 'resenas') return router.push('/comentarios' as any);
                if (o.id === 'bateria') return void onAjustesBateria();
                if (o.id === 'exportar') return void onExportar();
                if (o.id === 'importar') return void onImportar();
                if (o.id === 'tutorial') return void onVerTutorial();
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
            <Ionicons name="phone-portrait-outline" size={20} color={colors.purple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listLabel}>Calendario del teléfono</Text>
              <Text style={styles.muted}>
                {tel == null ? 'Verificando…' : tel ? 'Conectado ✓' : 'No conectado'}
              </Text>
            </View>
            {tel === false && (
              <Pressable style={styles.hcBtn} onPress={onConectarTel}>
                <Text style={styles.hcBtnText}>Conectar</Text>
              </Pressable>
            )}
            {tel === true && (
              <Pressable style={styles.hcBtnGhost} onPress={onDesconectarTel}>
                <Text style={styles.hcBtnGhostText}>Desconectar</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.muted}>
            Muestra en Mi semana los eventos del calendario del teléfono (incluye los de Google que el
            teléfono sincroniza). Si lo desconectás, la app deja de leerlos.
          </Text>

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
            Conectá Health Connect para traer tus pasos, comidas, etc. Para que haya datos, Samsung Health, Google Fit (u
            otra app de actividad) tiene que compartir tus pasos con Health Connect.
          </Text>

          {googleConfigurado() && (
            <>
              <View style={styles.hcRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLabel}>Google Calendar</Text>
                  <Text style={styles.muted}>
                    {google == null ? 'Verificando…' : google ? 'Conectado ✓' : 'No conectado'}
                  </Text>
                </View>
                {google === false && (
                  <Pressable style={styles.hcBtn} onPress={onConectarGoogle}>
                    <Text style={styles.hcBtnText}>Conectar</Text>
                  </Pressable>
                )}
                {google === true && (
                  <Pressable style={styles.hcBtnGhost} onPress={onDesconectarGoogle}>
                    <Text style={styles.hcBtnGhostText}>Desconectar</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.muted}>
                Conectá tu Google Calendar para que tus objetivos con horario se agenden ahí con el color que elijas. Si no
                lo conectás, se agendan en el calendario del teléfono, como siempre.
              </Text>
              {google === true && (
                <Pressable onPress={onRepararCalendario} disabled={reparando} hitSlop={6}>
                  <Text style={styles.repararLink}>
                    {reparando ? 'Reparando…' : '¿Ves eventos repetidos? Reparar duplicados'}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </Card>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        <Pressable
          style={styles.deleteAccountBtn}
          onPress={onEliminarCuenta}
          disabled={eliminando}>
          <Text style={styles.deleteAccountText}>
            {eliminando ? 'Eliminando…' : 'Eliminar mi cuenta'}
          </Text>
        </Pressable>

        <Text style={styles.privacidadPie}>
          Nuestra{' '}
          <Text
            style={styles.privacidadLink}
            onPress={() => Linking.openURL(POLITICA_URL).catch(() => {})}>
            política de privacidad
          </Text>
        </Text>
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
  repararLink: { fontSize: 12.5, color: colors.purple, fontWeight: '700', marginTop: 2 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  filaAccionText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  passInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.text },
  passInputSolo: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
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
  deleteAccountBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteAccountText: { color: colors.textMuted, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
  privacidadPie: { textAlign: 'center', color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  privacidadLink: { color: colors.purple, fontWeight: '700', textDecorationLine: 'underline' },
});
