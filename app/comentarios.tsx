import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import { guardarComentario, listarComentarios, miComentario, type Comentario } from '@/lib/data';

const PLAY_MARKET = 'market://details?id=com.sofiasoler.drakostone';
const PLAY_WEB = 'https://play.google.com/store/apps/details?id=com.sofiasoler.drakostone';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`;
}

function Estrellas({
  valor,
  onChange,
  size,
  colors,
}: {
  valor: number;
  onChange?: (n: number) => void;
  size: number;
  colors: Tema;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4}>
          <Ionicons
            name={n <= valor ? 'star' : 'star-outline'}
            size={size}
            color={n <= valor ? colors.purple : colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function ComentariosScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();

  const [puntaje, setPuntaje] = useState(0);
  const [texto, setTexto] = useState('');

  const { data: mio } = useQuery({ queryKey: ['mi-comentario'], queryFn: miComentario });
  const {
    data: muro,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['comentarios'], queryFn: listarComentarios });

  // Precarga la reseña propia (para editarla) la primera vez que llega.
  useEffect(() => {
    if (mio) {
      setPuntaje((p) => (p === 0 ? mio.puntaje : p));
      setTexto((t) => (t === '' ? mio.texto ?? '' : t));
    }
  }, [mio]);

  const guardar = useMutation({
    mutationFn: () => guardarComentario(puntaje, texto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comentarios'] });
      qc.invalidateQueries({ queryKey: ['mi-comentario'] });
      Alert.alert('¡Gracias por tu reseña! 🐉', 'Tu opinión nos ayuda a mejorar Drakostone.');
    },
    onError: (e) =>
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  function calificarEnPlay() {
    Linking.openURL(PLAY_MARKET).catch(() => Linking.openURL(PLAY_WEB).catch(() => {}));
  }

  const yaOpino = !!mio;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.h1}>Reseñas</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Tu reseña */}
          <Card style={{ gap: 12 }}>
            <Text style={styles.cardTitle}>{yaOpino ? 'Tu reseña' : 'Dejá tu reseña'}</Text>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Estrellas valor={puntaje} onChange={setPuntaje} size={36} colors={colors} />
              <Text style={styles.muted}>
                {puntaje === 0 ? 'Tocá las estrellas para puntuar' : `${puntaje} de 5`}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Contanos qué te pareció (opcional)"
              placeholderTextColor={colors.textMuted}
              value={texto}
              onChangeText={setTexto}
              multiline
            />
            <Pressable
              style={[styles.enviarBtn, (puntaje === 0 || guardar.isPending) && styles.btnOff]}
              onPress={() => guardar.mutate()}
              disabled={puntaje === 0 || guardar.isPending}>
              {guardar.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.enviarText}>{yaOpino ? 'Actualizar reseña' : 'Enviar reseña'}</Text>
              )}
            </Pressable>
          </Card>

          {/* Botón a Google Play */}
          <Pressable style={styles.playBtn} onPress={calificarEnPlay}>
            <Ionicons name="logo-google-playstore" size={18} color={colors.purple} />
            <Text style={styles.playText}>Calificar en Google Play</Text>
          </Pressable>

          {/* Muro */}
          <Text style={styles.sectionTitle}>Lo que opinan</Text>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={colors.purple} />
          ) : isError ? (
            <Pressable onPress={() => refetch()} style={styles.reintentar}>
              <Text style={styles.reintentarText}>No se pudieron cargar. Tocá para reintentar.</Text>
            </Pressable>
          ) : !muro?.length ? (
            <Text style={styles.vacio}>Todavía no hay reseñas. ¡Sé la primera! 🐉</Text>
          ) : (
            muro.map((c: Comentario) => (
              <Card key={c.id_comentario} style={{ gap: 6 }}>
                <View style={styles.muroHead}>
                  <Estrellas valor={c.puntaje} size={16} colors={colors} />
                  <Text style={styles.muroFecha}>{fechaCorta(c.created_at)}</Text>
                </View>
                {!!c.texto && <Text style={styles.muroTexto}>{c.texto}</Text>}
                <Text style={styles.muroAutor}>Anónimo</Text>
              </Card>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    h1: { fontSize: 20, fontWeight: '800', color: colors.text },
    cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    muted: { fontSize: 12.5, color: colors.textMuted },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      minHeight: 70,
      textAlignVertical: 'top',
    },
    enviarBtn: { backgroundColor: colors.purple, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
    btnOff: { opacity: 0.5 },
    enviarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingVertical: 12,
    },
    playText: { color: colors.purple, fontWeight: '800', fontSize: 14 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    vacio: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
    reintentar: { paddingVertical: 12, alignItems: 'center' },
    reintentarText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
    muroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    muroFecha: { fontSize: 11.5, color: colors.textMuted },
    muroTexto: { fontSize: 14, color: colors.text, lineHeight: 19 },
    muroAutor: { fontSize: 11.5, color: colors.textMuted, fontStyle: 'italic' },
  });
