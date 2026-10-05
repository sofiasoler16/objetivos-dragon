import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DragonButton } from '@/components/DragonButton';
import { ProfileButton } from '@/components/ProfileButton';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import { usePremium } from '@/hooks/usePremium';
import { crearGrupo, type GrupoResumen, misGrupos, unirsePorCodigo } from '@/lib/data';

// Emojis sugeridos para el grupo (el usuario puede no elegir ninguno → 👥 por defecto).
const EMOJIS = ['🏠', '👨‍👩‍👧', '✈️', '💪', '📚', '🎉', '⚽', '🍽️'];

export default function GruposScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const { esPremium } = usePremium();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [unirseAbierto, setUnirseAbierto] = useState(false);

  const {
    data: grupos,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['mis-grupos'], queryFn: misGrupos });

  function onCrear() {
    if (!esPremium) return router.push('/premium');
    setModalAbierto(true);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topbar}>
        <DragonButton />
        <ProfileButton />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Grupos</Text>
        <Text style={styles.sub}>
          Armá grupos con tu familia o amigos y repartan tareas y objetivos entre todos.
        </Text>

        <Pressable style={styles.crearBtn} onPress={onCrear}>
          <Ionicons name={esPremium ? 'add' : 'lock-closed'} size={18} color="#fff" />
          <Text style={styles.crearBtnText}>Crear grupo</Text>
          {!esPremium && <Text style={styles.crearBtnCorona}>👑</Text>}
        </Pressable>

        <Pressable style={styles.unirseBtn} onPress={() => setUnirseAbierto(true)}>
          <Ionicons name="enter-outline" size={17} color={colors.purple} />
          <Text style={styles.unirseBtnText}>Unirme a un grupo con un código</Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.purple} />
        ) : isError ? (
          <Pressable style={styles.reintentar} onPress={() => refetch()}>
            <Text style={styles.reintentarText}>No se pudieron cargar tus grupos. Reintentar</Text>
          </Pressable>
        ) : (grupos?.length ?? 0) === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioEmoji}>🧑‍🤝‍🧑</Text>
            <Text style={styles.vacioText}>
              Todavía no tenés grupos.{'\n'}
              {esPremium ? 'Creá el primero con el botón de arriba.' : 'Con Premium podés crear grupos e invitar gente.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {grupos!.map((g) => (
              <GrupoCard key={g.id_grupo} grupo={g} colors={colors} />
            ))}
          </View>
        )}
      </ScrollView>

      <CrearGrupoModal
        visible={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onCreado={() => {
          setModalAbierto(false);
          queryClient.invalidateQueries({ queryKey: ['mis-grupos'] });
        }}
        colors={colors}
      />

      <UnirseModal visible={unirseAbierto} onClose={() => setUnirseAbierto(false)} colors={colors} />
    </SafeAreaView>
  );
}

function UnirseModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const codigoOk = codigo.trim().length >= 6;

  const unirse = useMutation({
    mutationFn: () => unirsePorCodigo(codigo.trim()),
    onSuccess: (idGrupo) => {
      setCodigo('');
      qc.invalidateQueries({ queryKey: ['mis-grupos'] });
      onClose();
      router.push(`/grupo/${idGrupo}`);
    },
    onError: (e) => Alert.alert('No se pudo unir', e instanceof Error ? e.message : 'Revisá el código.'),
  });

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.popupFondo}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.popupCard}>
          <Pressable style={styles.popupX} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.popupTitulo}>Unirme a un grupo</Text>
          <Text style={styles.muted}>Ingresá el código que te pasaron.</Text>
          <TextInput
            style={styles.codigoInput}
            placeholder="Ej: 3F9A2B7C"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            maxLength={12}
            autoFocus
          />
          <Pressable
            style={[styles.btnPrimary, (!codigoOk || unirse.isPending) && { opacity: 0.5 }]}
            onPress={() => unirse.mutate()}
            disabled={!codigoOk || unirse.isPending}>
            {unirse.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Listo</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GrupoCard({ grupo, colors }: { grupo: GrupoResumen; colors: Tema }) {
  const styles = makeStyles(colors);
  return (
    <Pressable onPress={() => router.push(`/grupo/${grupo.id_grupo}`)}>
      <Card style={styles.grupoRow}>
        <View style={styles.grupoIcono}>
          <Text style={{ fontSize: 22 }}>{grupo.icono ?? '👥'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
          <Text style={styles.muted}>
            {grupo.cant_miembros} {grupo.cant_miembros === 1 ? 'miembro' : 'miembros'}
            {grupo.es_admin ? ' · Admin' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

function CrearGrupoModal({
  visible,
  onClose,
  onCreado,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onCreado: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () => crearGrupo(nombre.trim(), emoji),
    onSuccess: () => {
      setNombre('');
      setEmoji(null);
      onCreado();
    },
    onError: (e) => Alert.alert('No se pudo crear', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalFondo}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.modalTitulo}>Nuevo grupo</Text>

          <Text style={styles.campoLabel}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Familia, Viaje, Roommates…"
            placeholderTextColor={colors.textMuted}
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />

          <Text style={styles.campoLabel}>Ícono (opcional)</Text>
          <View style={styles.emojiWrap}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji((prev) => (prev === e ? null : e))}
                style={[styles.emojiChip, emoji === e && styles.emojiChipOn]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable style={[styles.btnGhost, { flex: 1 }]} onPress={onClose} disabled={crear.isPending}>
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, { flex: 1 }, (!nombre.trim() || crear.isPending) && { opacity: 0.5 }]}
              onPress={() => crear.mutate()}
              disabled={!nombre.trim() || crear.isPending}>
              {crear.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Crear</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: 6,
      paddingBottom: 6,
    },
    scroll: { padding: spacing.lg, paddingBottom: 40, gap: 6 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    sub: { fontSize: 14, color: colors.textMuted, marginBottom: 8, lineHeight: 19 },
    crearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.purple,
      borderRadius: 14,
      paddingVertical: 13,
    },
    crearBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    crearBtnCorona: { fontSize: 14 },
    unirseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 14,
      paddingVertical: 12,
      marginTop: 8,
    },
    unirseBtnText: { color: colors.purple, fontWeight: '700', fontSize: 14 },
    reintentar: { alignItems: 'center', paddingVertical: 24 },
    reintentarText: { color: colors.purple, fontWeight: '700' },
    vacio: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    vacioEmoji: { fontSize: 46 },
    vacioText: { fontSize: 14.5, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
    grupoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    grupoIcono: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.purple100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grupoNombre: { fontSize: 16, fontWeight: '700', color: colors.text },
    muted: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    // Modal
    modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: spacing.lg,
      paddingBottom: 32,
      gap: 8,
    },
    modalTitulo: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: 4 },
    campoLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '700', marginTop: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    emojiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emojiChip: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiChipOn: { borderColor: colors.purple, backgroundColor: colors.purple100 },
    btnGhost: {
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 999,
      paddingVertical: 13,
    },
    btnGhostText: { color: colors.text, fontWeight: '700', fontSize: 14 },
    btnPrimary: { alignItems: 'center', backgroundColor: colors.purple, borderRadius: 999, paddingVertical: 13 },
    btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    // Popup "unirme con código" (centrado, con X)
    popupFondo: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    popupCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.bg,
      borderRadius: 20,
      padding: spacing.lg,
      gap: 10,
    },
    popupX: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
    popupTitulo: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 2 },
    codigoInput: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 20,
      letterSpacing: 3,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.text,
      backgroundColor: colors.surface,
    },
  });
