import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { DateTimeField } from '@/components/ui/DateTimeField';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  actualizarTarea,
  crearTarea,
  eliminarTarea,
  listarCategorias,
  type NuevaTarea,
  obtenerTarea,
} from '@/lib/data';
import { dateAHora, dateAISO, fechaLarga, horaADate, isoADate } from '@/logic/fecha';

type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA';

export default function TareaFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNuevo = id === 'nuevo';
  const queryClient = useQueryClient();
  const colors = useTheme();
  const styles = makeStyles(colors);

  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  const { data: tarea, isLoading } = useQuery({
    queryKey: ['tarea', id],
    queryFn: () => obtenerTarea(id),
    enabled: !esNuevo,
  });

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idCategoria, setIdCategoria] = useState<string | null>(null);
  const [prioridad, setPrioridad] = useState<Prioridad>('MEDIA');
  const [fechaLimite, setFechaLimite] = useState('');
  const [horaLimite, setHoraLimite] = useState('');

  useEffect(() => {
    if (!tarea) return;
    setTitulo(tarea.titulo);
    setDescripcion(tarea.descripcion ?? '');
    setIdCategoria(tarea.id_categoria);
    setPrioridad(tarea.prioridad);
    setFechaLimite(tarea.fecha_limite ?? '');
    setHoraLimite(tarea.hora_limite?.slice(0, 5) ?? '');
  }, [tarea]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['tareas'] });
    if (!esNuevo) queryClient.invalidateQueries({ queryKey: ['tarea', id] });
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: NuevaTarea = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        id_categoria: idCategoria,
        prioridad,
        fecha_limite: fechaLimite.trim() || null,
        hora_limite: horaLimite.trim() || null,
      };
      if (esNuevo) await crearTarea(payload);
      else await actualizarTarea(id, payload);
    },
    onSuccess: () => {
      invalidar();
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.'),
  });

  const borrar = useMutation({
    mutationFn: () => eliminarTarea(id),
    onSuccess: () => {
      invalidar();
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar.'),
  });

  function validarYGuardar() {
    if (!titulo.trim()) return Alert.alert('Falta el título', 'Poné un título para la tarea.');
    guardar.mutate();
  }

  function confirmarBorrado() {
    Alert.alert('Eliminar tarea', `¿Seguro que querés eliminar "${titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => borrar.mutate() },
    ]);
  }

  if (!esNuevo && isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.h1}>{esNuevo ? 'Nueva tarea' : 'Editar tarea'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Título</Text>
        <TextInput style={styles.input} placeholder="Ej: Entregar TP de auditoría" placeholderTextColor={colors.textMuted} value={titulo} onChangeText={setTitulo} />

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput style={styles.input} placeholder="Nota corta" placeholderTextColor={colors.textMuted} value={descripcion} onChangeText={setDescripcion} />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chipsWrap}>
          <Pressable onPress={() => setIdCategoria(null)} style={[styles.chip, idCategoria === null && styles.chipSel]}>
            <Text style={[styles.chipText, idCategoria === null && styles.chipTextSel]}>Ninguna</Text>
          </Pressable>
          {categorias?.map((c) => (
            <Pressable
              key={c.id_categoria}
              onPress={() => setIdCategoria(c.id_categoria)}
              style={[styles.chip, idCategoria === c.id_categoria && styles.chipSel]}>
              <Text style={[styles.chipText, idCategoria === c.id_categoria && styles.chipTextSel]}>
                {c.icono} {c.nombre}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Prioridad</Text>
        <View style={styles.segment}>
          {(['BAJA', 'MEDIA', 'ALTA'] as Prioridad[]).map((p) => (
            <Pressable key={p} onPress={() => setPrioridad(p)} style={[styles.segBtn, prioridad === p && styles.segBtnSel]}>
              <Text style={[styles.segText, prioridad === p && styles.segTextSel]}>
                {p === 'BAJA' ? 'Baja' : p === 'MEDIA' ? 'Media' : 'Alta'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Fecha límite (opcional)</Text>
        <DateTimeField
          mode="date"
          value={isoADate(fechaLimite)}
          onChange={(d) => setFechaLimite(dateAISO(d))}
          onClear={() => setFechaLimite('')}
          placeholder="Sin fecha límite"
          minimumDate={new Date()}
          formato={(d) => fechaLarga(dateAISO(d))}
        />

        <Text style={styles.label}>Hora (opcional)</Text>
        <DateTimeField
          mode="time"
          value={horaADate(horaLimite)}
          onChange={(d) => setHoraLimite(dateAHora(d))}
          onClear={() => setHoraLimite('')}
          placeholder="Sin hora"
          formato={(d) => dateAHora(d)}
        />

        <Pressable
          style={[styles.saveBtn, guardar.isPending && { opacity: 0.6 }]}
          onPress={validarYGuardar}
          disabled={guardar.isPending}>
          {guardar.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{esNuevo ? 'Crear tarea' : 'Guardar cambios'}</Text>
          )}
        </Pressable>

        {!esNuevo && (
          <Pressable style={styles.deleteBtn} onPress={confirmarBorrado} disabled={borrar.isPending}>
            <Text style={styles.deleteBtnText}>Eliminar tarea</Text>
          </Pressable>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipSel: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextSel: { color: '#fff' },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
  },
  segBtnSel: { backgroundColor: colors.purple, borderColor: colors.purple },
  segText: { fontSize: 14, color: colors.text, fontWeight: '700' },
  segTextSel: { color: '#fff' },
  saveBtn: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.redBorder,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteBtnText: { color: colors.red, fontWeight: '800', fontSize: 15 },
});
