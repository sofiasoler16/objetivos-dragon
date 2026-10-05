import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { spacing, type Tema } from '@/constants/theme';
import { eliminarTarea, listarCategorias, obtenerTarea, ocultarTarea, reprogramarTarea } from '@/lib/data';
import { dateAISO, fechaLarga, fechaLargaConDia, hoyISO, isoADate } from '@/logic/fecha';

const PRIORIDAD = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' } as const;
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null);

export default function TareaInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const [reprogramando, setReprogramando] = useState(false);

  const { data: tarea, isLoading } = useQuery({
    queryKey: ['tarea', id],
    queryFn: () => obtenerTarea(id),
  });
  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });

  const invalidar = () => {
    for (const k of [['tareas'], ['esperados-hoy'], ['progreso-dias'], ['progreso-mes'], ['detalle-dia'], ['agenda-semana'], ['tarea', id]])
      queryClient.invalidateQueries({ queryKey: k });
  };
  const reprogramar = useMutation({
    mutationFn: (fecha: string) => reprogramarTarea(id, fecha, tarea?.hora_limite ?? null),
    onSuccess: () => {
      invalidar();
      setReprogramando(false);
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo reprogramar.'),
  });
  const borrar = useMutation({
    // Vencida (fecha en el pasado) → ocultar (queda como no-hecha en su día). Si no, borrar de verdad.
    mutationFn: () => {
      const pasada = !!tarea?.fecha_limite && tarea.fecha_limite.slice(0, 10) < hoyISO();
      return pasada ? ocultarTarea(id).then(() => {}) : eliminarTarea(id);
    },
    onSuccess: () => {
      invalidar();
      router.back();
    },
    onError: (e) => {
      const err = e as { message?: string; code?: string };
      Alert.alert('Error al eliminar', `${err?.message || 'No se pudo eliminar.'}${err?.code ? `\n\n(código ${err.code})` : ''}`);
    },
  });

  function confirmarBorrado() {
    const pasada = !!tarea?.fecha_limite && tarea.fecha_limite.slice(0, 10) < hoyISO();
    Alert.alert(
      'Eliminar tarea',
      pasada
        ? 'Como ya venció, va a desaparecer de tus listas pero quedará como "no hecha" en el % de su día.'
        : '¿Seguro que querés eliminar esta tarea?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => borrar.mutate() },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (!tarea) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <Encabezado colors={colors} />
        <Text style={styles.muted}>No encontramos esta tarea.</Text>
      </SafeAreaView>
    );
  }

  const cat = categorias?.find((c) => c.id_categoria === tarea.id_categoria);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Encabezado colors={colors} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.nombre}>{tarea.titulo}</Text>
        {cat && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {cat.icono} {cat.nombre}
            </Text>
          </View>
        )}

        <Card style={styles.card}>
          {tarea.descripcion ? <Fila colors={colors} etiqueta="Descripción" valor={tarea.descripcion} /> : null}
          <Fila colors={colors} etiqueta="Prioridad" valor={PRIORIDAD[tarea.prioridad]} />
          <Fila
            colors={colors}
            etiqueta="Vence"
            valor={tarea.fecha_limite ? fechaLarga(tarea.fecha_limite.slice(0, 10)) : 'Sin fecha'}
          />
          {hhmm(tarea.hora_limite) ? (
            <Fila colors={colors} etiqueta="Hora" valor={hhmm(tarea.hora_limite)!} />
          ) : null}
          <Fila
            colors={colors}
            etiqueta="Estado"
            valor={tarea.completada ? 'Completada' : 'Pendiente'}
            ultima
          />
        </Card>

        <Pressable style={styles.editBtn} onPress={() => router.push(`/tarea/${id}`)}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.editBtnText}>Editar tarea</Text>
        </Pressable>

        {/* Reprogramar: elegir una fecha nueva → vuelve a ser una tarea normal con ese día. */}
        {reprogramando ? (
          <View style={styles.reprogBox}>
            <Text style={styles.filaEtiqueta}>Nueva fecha</Text>
            <DateTimeField
              mode="date"
              value={isoADate(tarea.fecha_limite?.slice(0, 10) ?? hoyISO())}
              onChange={(d) => reprogramar.mutate(dateAISO(d))}
              placeholder="Elegí el día"
              formato={(d) => fechaLargaConDia(dateAISO(d))}
            />
            <Pressable onPress={() => setReprogramando(false)} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.reprogBtn} onPress={() => setReprogramando(true)}>
            <Ionicons name="calendar-outline" size={17} color={colors.purple} />
            <Text style={styles.reprogBtnText}>Reprogramar</Text>
          </Pressable>
        )}

        <Pressable style={styles.borrarBtn} disabled={borrar.isPending} onPress={confirmarBorrado}>
          <Ionicons name="trash-outline" size={17} color={colors.red} />
          <Text style={styles.borrarBtnText}>Eliminar tarea</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Encabezado({ colors }: { colors: Tema }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.h1}>Tarea</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}

function Fila({
  colors,
  etiqueta,
  valor,
  ultima,
}: {
  colors: Tema;
  etiqueta: string;
  valor: string;
  ultima?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={[styles.fila, ultima && { borderBottomWidth: 0 }]}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
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
      paddingBottom: 4,
    },
    h1: { fontSize: 18, fontWeight: '800', color: colors.text },
    scroll: { padding: spacing.lg, gap: 12, paddingBottom: 40 },
    nombre: { fontSize: 24, fontWeight: '800', color: colors.text },
    muted: { fontSize: 14, color: colors.textMuted, paddingHorizontal: spacing.lg },
    chip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
    card: { gap: 0 },
    fila: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 3 },
    filaEtiqueta: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    filaValor: { fontSize: 15, color: colors.text, lineHeight: 21 },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.purple,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: 8,
    },
    editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    reprogBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 14,
      paddingVertical: 13,
    },
    reprogBtnText: { color: colors.purple, fontSize: 15, fontWeight: '800' },
    reprogBox: { gap: 8, backgroundColor: colors.surface, borderRadius: 14, padding: 12 },
    borrarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    borrarBtnText: { color: colors.red, fontSize: 14.5, fontWeight: '800' },
    link: { color: colors.purple, fontWeight: '700', fontSize: 13 },
  });
