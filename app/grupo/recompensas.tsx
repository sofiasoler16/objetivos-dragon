import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import {
  borrarRecompensa,
  canjearRecompensa,
  crearRecompensa,
  detalleGrupo,
  marcarCanjeUsado,
  type MiCanje,
  misCanjesGrupo,
  misPuntosGrupo,
  PUNTOS_ITEM,
  puntosMiembrosGrupo,
  type RecompensaGrupo,
  recompensasGrupo,
} from '@/lib/data';

export default function RecompensasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idGrupo = String(id);
  const colors = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();
  const [crearAbierto, setCrearAbierto] = useState(false);

  const { data: grupo } = useQuery({ queryKey: ['grupo', idGrupo], queryFn: () => detalleGrupo(idGrupo) });
  const { data: puntos = 0 } = useQuery({
    queryKey: ['mis-puntos-grupo', idGrupo],
    queryFn: () => misPuntosGrupo(idGrupo),
  });
  const { data: ranking } = useQuery({
    queryKey: ['puntos-miembros-grupo', idGrupo],
    queryFn: () => puntosMiembrosGrupo(idGrupo),
  });
  const { data: recompensas, isLoading } = useQuery({
    queryKey: ['recompensas-grupo', idGrupo],
    queryFn: () => recompensasGrupo(idGrupo),
  });
  const { data: misCanjes } = useQuery({
    queryKey: ['mis-canjes-grupo', idGrupo],
    queryFn: () => misCanjesGrupo(idGrupo),
  });

  const esAdmin = grupo?.es_admin ?? false;

  const invalidarPuntos = () => {
    qc.invalidateQueries({ queryKey: ['mis-puntos-grupo', idGrupo] });
    qc.invalidateQueries({ queryKey: ['puntos-miembros-grupo', idGrupo] });
  };

  const canjear = useMutation({
    mutationFn: (idR: string) => canjearRecompensa(idR),
    onSuccess: () => {
      invalidarPuntos();
      qc.invalidateQueries({ queryKey: ['mis-canjes-grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['recompensas-grupo', idGrupo] });
      Alert.alert('¡Canjeado! 🎉', 'Quedó en "Tus premios". Marcalo como usado cuando lo uses.');
    },
    onError: (e) => Alert.alert('No se pudo canjear', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const usar = useMutation({
    mutationFn: (idC: string) => marcarCanjeUsado(idC),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-canjes-grupo', idGrupo] }),
    onError: (e) => Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  function confirmarUsar(c: MiCanje) {
    Alert.alert('Marcar como usado', `¿Ya usaste "${c.nombre}"? Se va a borrar solo en unos días.`, [
      { text: 'Todavía no', style: 'cancel' },
      { text: 'Ya lo usé', onPress: () => usar.mutate(c.id_canje) },
    ]);
  }

  const borrar = useMutation({
    mutationFn: (idR: string) => borrarRecompensa(idR),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recompensas-grupo', idGrupo] }),
    onError: (e) => Alert.alert('No se pudo borrar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  function confirmarCanje(r: RecompensaGrupo) {
    Alert.alert('Canjear', `¿Canjear "${r.nombre}" por ${r.costo} puntos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Canjear', onPress: () => canjear.mutate(r.id_recompensa) },
    ]);
  }
  function confirmarBorrar(r: RecompensaGrupo) {
    Alert.alert('Borrar recompensa', `¿Borrar "${r.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => borrar.mutate(r.id_recompensa) },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.titulo} numberOfLines={1}>
          Recompensas
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Mis puntos */}
        <Card style={styles.puntosCard}>
          <Text style={styles.puntosLabel}>Tus puntos en {grupo?.nombre ?? 'el grupo'}</Text>
          <Text style={styles.puntosValor}>⭐ {puntos}</Text>
        </Card>

        {/* Tus premios canjeados */}
        {(misCanjes?.length ?? 0) > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.seccion}>Tus premios</Text>
            <View style={{ gap: 10 }}>
              {misCanjes!.map((c) => (
                <Card key={c.id_canje} style={[styles.premioRow, c.usado && { opacity: 0.55 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.premioNombre}>🎟️ {c.nombre}</Text>
                    <Text style={styles.premioCosto}>{c.usado ? 'Usado · se borra en unos días' : 'Listo para usar'}</Text>
                  </View>
                  {c.usado ? (
                    <View style={styles.usadoTag}>
                      <Ionicons name="checkmark" size={15} color={colors.textMuted} />
                      <Text style={styles.usadoTagText}>Usado</Text>
                    </View>
                  ) : (
                    <Pressable style={styles.usarBtn} onPress={() => confirmarUsar(c)} disabled={usar.isPending}>
                      <Text style={styles.usarBtnText}>Marcar usado</Text>
                    </Pressable>
                  )}
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Ranking de miembros */}
        {(ranking?.length ?? 0) > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.seccion}>Puntos de cada uno</Text>
            <Card style={{ gap: 10 }}>
              {ranking!.map((m, i) => (
                <View key={m.id_miembro} style={styles.rankRow}>
                  <Text style={styles.rankPos}>{i + 1}</Text>
                  <Text style={[styles.rankNombre, m.es_yo && { fontWeight: '800', color: colors.purple }]} numberOfLines={1}>
                    {m.nombre}
                    {m.es_yo ? ' (vos)' : ''}
                  </Text>
                  <Text style={styles.rankPts}>⭐ {m.puntos}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Catálogo */}
        <View style={styles.seccionRow}>
          <Text style={styles.seccion}>Premios para canjear</Text>
          {esAdmin && (
            <Pressable onPress={() => setCrearAbierto(true)} hitSlop={8}>
              <Text style={styles.nuevo}>＋ Nueva</Text>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.purple} />
        ) : (recompensas?.length ?? 0) === 0 ? (
          <Card>
            <Text style={styles.vacio}>
              {esAdmin
                ? 'Todavía no hay recompensas. Tocá "Nueva" para crear la primera (ej: "Elegir la película = 50 pts").'
                : 'Todavía no hay recompensas. El admin puede crearlas.'}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {recompensas!.map((r) => {
              const alcanza = puntos >= r.costo;
              return (
                <Card key={r.id_recompensa} style={styles.premioRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.premioNombre}>{r.nombre}</Text>
                    <Text style={styles.premioCosto}>
                      ⭐ {r.costo} puntos{r.unica ? ' · un solo canje' : ''}
                    </Text>
                  </View>
                  {r.puedo_borrar && (
                    <Pressable onPress={() => confirmarBorrar(r)} hitSlop={8} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color={colors.red} />
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.canjeBtn, !alcanza && styles.canjeBtnOff]}
                    onPress={() => confirmarCanje(r)}
                    disabled={!alcanza || canjear.isPending}>
                    <Text style={[styles.canjeBtnText, !alcanza && { color: colors.textMuted }]}>
                      {alcanza ? 'Canjear' : `Faltan ${r.costo - puntos}`}
                    </Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <CrearRecompensaModal
        visible={crearAbierto}
        idGrupo={idGrupo}
        onClose={() => setCrearAbierto(false)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

function CrearRecompensaModal({
  visible,
  idGrupo,
  onClose,
  colors,
}: {
  visible: boolean;
  idGrupo: string;
  onClose: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [costo, setCosto] = useState('');
  const [unica, setUnica] = useState(false);

  const crear = useMutation({
    mutationFn: () => crearRecompensa(idGrupo, nombre.trim(), Number(costo), unica),
    onSuccess: () => {
      setNombre('');
      setCosto('');
      setUnica(false);
      qc.invalidateQueries({ queryKey: ['recompensas-grupo', idGrupo] });
      onClose();
    },
    onError: (e) => Alert.alert('No se pudo crear', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const costoNum = Number(costo);
  const valido = nombre.trim().length > 0 && Number.isFinite(costoNum) && costoNum > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalFondo} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.modalTitulo}>Nueva recompensa</Text>
          <Text style={styles.modalSub}>Un premio que se canjea por puntos (ej: "Elegir la película").</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del premio"
            placeholderTextColor={colors.textMuted}
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Costo en puntos (ej: 50)"
            placeholderTextColor={colors.textMuted}
            value={costo}
            onChangeText={(t) => setCosto(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          {/* Leyenda: cuántos puntos da cada cumplimiento (para saber qué precio poner) */}
          <View style={styles.legendBox}>
            <Text style={styles.legendTitulo}>Cada cumplimiento da:</Text>
            <Text style={styles.legendText}>
              Objetivo ⭐ {PUNTOS_ITEM.objetivo} · Tarea baja ⭐ {PUNTOS_ITEM.tareaBaja} · media ⭐{' '}
              {PUNTOS_ITEM.tareaMedia} · alta ⭐ {PUNTOS_ITEM.tareaAlta}
            </Text>
          </View>

          <View style={styles.unicaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.unicaTitulo}>Un solo canje</Text>
              <Text style={styles.unicaSub}>Desaparece del catálogo cuando alguien la canjea.</Text>
            </View>
            <Switch
              value={unica}
              onValueChange={setUnica}
              trackColor={{ true: colors.purple, false: colors.track }}
              thumbColor="#fff"
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable style={[styles.btnGhost, { flex: 1 }]} onPress={onClose} disabled={crear.isPending}>
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, { flex: 1 }, (!valido || crear.isPending) && { opacity: 0.5 }]}
              onPress={() => crear.mutate()}
              disabled={!valido || crear.isPending}>
              {crear.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Crear</Text>}
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
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: 8,
      paddingBottom: 6,
    },
    titulo: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
    scroll: { padding: spacing.lg, paddingTop: 4, paddingBottom: 40 },
    puntosCard: { alignItems: 'center', gap: 4, paddingVertical: 18 },
    puntosLabel: { fontSize: 13.5, color: colors.textMuted },
    puntosValor: { fontSize: 34, fontWeight: '900', color: colors.purple },
    seccion: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8, marginTop: 8 },
    seccionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    nuevo: { color: colors.purple, fontWeight: '800', fontSize: 14, marginBottom: 8 },
    vacio: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20 },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rankPos: { fontSize: 14, fontWeight: '900', color: colors.textMuted, width: 20 },
    rankNombre: { flex: 1, fontSize: 14.5, color: colors.text },
    rankPts: { fontSize: 14, fontWeight: '800', color: colors.text },
    premioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    premioNombre: { fontSize: 15, fontWeight: '700', color: colors.text },
    premioCosto: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    canjeBtn: {
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 16,
    },
    canjeBtnOff: { backgroundColor: colors.track },
    canjeBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    usarBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    usarBtnText: { color: colors.purple, fontWeight: '800', fontSize: 12.5 },
    usadoTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    usadoTagText: { color: colors.textMuted, fontWeight: '700', fontSize: 12.5 },
    legendBox: {
      backgroundColor: colors.purple100,
      borderRadius: 12,
      padding: 12,
    },
    legendTitulo: { fontSize: 12.5, fontWeight: '800', color: colors.purple700 },
    legendText: { fontSize: 12.5, color: colors.purple700, marginTop: 3, lineHeight: 18 },
    unicaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
    },
    unicaTitulo: { fontSize: 14, fontWeight: '800', color: colors.text },
    unicaSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
    modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: spacing.lg,
      gap: 12,
    },
    modalTitulo: { fontSize: 18, fontWeight: '800', color: colors.text },
    modalSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    btnGhost: { alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
    btnGhostText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
    btnPrimary: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.purple },
    btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  });
