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
  actualizarObjetivo,
  crearObjetivo,
  eliminarObjetivo,
  listarCategorias,
  type NuevoObjetivo,
  obtenerObjetivo,
  setDiasObjetivo,
} from '@/lib/data';
import { dateAHora, dateAISO, fechaLarga, horaADate, hoyISO, isoADate } from '@/logic/fecha';

type Tipo = 'BOOLEAN' | 'NUMERIC';
type Frecuencia = 'DAILY' | 'SPECIFIC_DAYS' | 'WEEKLY_COUNT';

const DIAS = [
  { iso: 1, l: 'L' },
  { iso: 2, l: 'M' },
  { iso: 3, l: 'M' },
  { iso: 4, l: 'J' },
  { iso: 5, l: 'V' },
  { iso: 6, l: 'S' },
  { iso: 7, l: 'D' },
];

export default function ObjetivoFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNuevo = id === 'nuevo';
  const queryClient = useQueryClient();
  const colors = useTheme();
  const styles = makeStyles(colors);

  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  const { data: objetivo, isLoading } = useQuery({
    queryKey: ['objetivo', id],
    queryFn: () => obtenerObjetivo(id),
    enabled: !esNuevo,
  });

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idCategoria, setIdCategoria] = useState<string | null>(null);
  const [tipo, setTipo] = useState<Tipo>('BOOLEAN');
  const [metaValor, setMetaValor] = useState('');
  const [unidad, setUnidad] = useState('');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('DAILY');
  const [dias, setDias] = useState<number[]>([]);
  const [cantidad, setCantidad] = useState('');
  const [hora, setHora] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Prefill al editar
  useEffect(() => {
    if (!objetivo) return;
    setNombre(objetivo.nombre);
    setDescripcion(objetivo.descripcion ?? '');
    setIdCategoria(objetivo.id_categoria);
    setTipo(objetivo.tipo);
    setMetaValor(objetivo.meta_valor != null ? String(objetivo.meta_valor) : '');
    setUnidad(objetivo.unidad ?? '');
    setFrecuencia(objetivo.frecuencia_tipo);
    setDias(objetivo.dias);
    setCantidad(objetivo.frecuencia_cantidad != null ? String(objetivo.frecuencia_cantidad) : '');
    setHora(objetivo.hora_recordatorio?.slice(0, 5) ?? '');
    setFechaInicio(objetivo.fecha_inicio ?? '');
    setFechaFin(objetivo.fecha_fin ?? '');
  }, [objetivo]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['objetivos'] });
    if (!esNuevo) queryClient.invalidateQueries({ queryKey: ['objetivo', id] });
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: NuevoObjetivo = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        id_categoria: idCategoria,
        tipo,
        frecuencia_tipo: frecuencia,
        frecuencia_cantidad: frecuencia === 'WEEKLY_COUNT' ? Number(cantidad) : null,
        meta_valor: tipo === 'NUMERIC' ? Number(metaValor) : null,
        unidad: tipo === 'NUMERIC' ? unidad.trim() || null : null,
        hora_recordatorio: hora.trim() || null,
        fecha_inicio: fechaInicio || hoyISO(), // fecha LOCAL (no UTC), si no aparecería mañana
        fecha_fin: fechaFin || null,
      };
      if (esNuevo) {
        await crearObjetivo(payload, dias);
      } else {
        await actualizarObjetivo(id, payload);
        await setDiasObjetivo(id, frecuencia === 'SPECIFIC_DAYS' ? dias : []);
      }
    },
    onSuccess: () => {
      invalidar();
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.'),
  });

  const borrar = useMutation({
    mutationFn: () => eliminarObjetivo(id),
    onSuccess: () => {
      invalidar();
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar.'),
  });

  function validarYGuardar() {
    if (!nombre.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre para el objetivo.');
    if (tipo === 'NUMERIC' && !(Number(metaValor) > 0))
      return Alert.alert('Meta inválida', 'Ingresá una meta numérica mayor a 0.');
    if (frecuencia === 'WEEKLY_COUNT' && !(Number(cantidad) > 0))
      return Alert.alert('Cantidad inválida', 'Ingresá cuántas veces por semana (mayor a 0).');
    if (frecuencia === 'SPECIFIC_DAYS' && dias.length === 0)
      return Alert.alert('Elegí los días', 'Seleccioná al menos un día de la semana.');
    if (fechaInicio && fechaFin && fechaFin < fechaInicio)
      return Alert.alert('Fechas inválidas', 'La fecha de fin no puede ser anterior a la de inicio.');
    guardar.mutate();
  }

  function confirmarBorrado() {
    Alert.alert('Eliminar objetivo', `¿Seguro que querés eliminar "${nombre}"?`, [
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
        <Text style={styles.h1}>{esNuevo ? 'Nuevo objetivo' : 'Editar objetivo'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} placeholder="Ej: Ir al gym" value={nombre} onChangeText={setNombre} />

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput style={styles.input} placeholder="Nota corta" value={descripcion} onChangeText={setDescripcion} />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chipsWrap}>
          <Pressable
            onPress={() => setIdCategoria(null)}
            style={[styles.chip, idCategoria === null && styles.chipSel]}>
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

        <Text style={styles.label}>Tipo</Text>
        <View style={styles.segment}>
          {(['BOOLEAN', 'NUMERIC'] as Tipo[]).map((t) => (
            <Pressable key={t} onPress={() => setTipo(t)} style={[styles.segBtn, tipo === t && styles.segBtnSel]}>
              <Text style={[styles.segText, tipo === t && styles.segTextSel]}>
                {t === 'BOOLEAN' ? 'Sí / No' : 'Numérico'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tipo === 'NUMERIC' && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Meta</Text>
              <TextInput
                style={styles.input}
                placeholder="2000"
                keyboardType="numeric"
                value={metaValor}
                onChangeText={setMetaValor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unidad</Text>
              <TextInput style={styles.input} placeholder="ml, pasos…" value={unidad} onChangeText={setUnidad} />
            </View>
          </View>
        )}

        <Text style={styles.label}>Frecuencia</Text>
        <View style={styles.segmentCol}>
          {(
            [
              ['DAILY', 'Todos los días'],
              ['SPECIFIC_DAYS', 'Días específicos'],
              ['WEEKLY_COUNT', 'Veces por semana'],
            ] as [Frecuencia, string][]
          ).map(([f, l]) => (
            <Pressable key={f} onPress={() => setFrecuencia(f)} style={[styles.segBtnCol, frecuencia === f && styles.segBtnSel]}>
              <Text style={[styles.segText, frecuencia === f && styles.segTextSel]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {frecuencia === 'SPECIFIC_DAYS' && (
          <View style={styles.diasWrap}>
            {DIAS.map((d) => {
              const sel = dias.includes(d.iso);
              return (
                <Pressable
                  key={d.iso}
                  onPress={() =>
                    setDias((prev) => (sel ? prev.filter((x) => x !== d.iso) : [...prev, d.iso]))
                  }
                  style={[styles.dia, sel && styles.diaSel]}>
                  <Text style={[styles.diaText, sel && styles.diaTextSel]}>{d.l}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {frecuencia === 'WEEKLY_COUNT' && (
          <>
            <Text style={styles.label}>¿Cuántas veces por semana?</Text>
            <TextInput
              style={styles.input}
              placeholder="3"
              keyboardType="numeric"
              value={cantidad}
              onChangeText={setCantidad}
            />
          </>
        )}

        <Text style={styles.label}>Hora de recordatorio (opcional)</Text>
        <DateTimeField
          mode="time"
          value={horaADate(hora)}
          onChange={(d) => setHora(dateAHora(d))}
          onClear={() => setHora('')}
          placeholder="Sin recordatorio"
          formato={(d) => dateAHora(d)}
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Empieza (opcional)</Text>
            <DateTimeField
              mode="date"
              value={isoADate(fechaInicio)}
              onChange={(d) => setFechaInicio(dateAISO(d))}
              onClear={() => setFechaInicio('')}
              placeholder="Hoy"
              formato={(d) => fechaLarga(dateAISO(d))}
            />
          </View>
        </View>
        <Text style={styles.label}>Termina (opcional)</Text>
        <DateTimeField
          mode="date"
          value={isoADate(fechaFin)}
          onChange={(d) => setFechaFin(dateAISO(d))}
          onClear={() => setFechaFin('')}
          placeholder="Sin fecha de fin"
          minimumDate={isoADate(fechaInicio) ?? undefined}
          formato={(d) => fechaLarga(dateAISO(d))}
        />

        <Pressable
          style={[styles.saveBtn, guardar.isPending && { opacity: 0.6 }]}
          onPress={validarYGuardar}
          disabled={guardar.isPending}>
          {guardar.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{esNuevo ? 'Crear objetivo' : 'Guardar cambios'}</Text>
          )}
        </Pressable>

        {!esNuevo && (
          <Pressable style={styles.deleteBtn} onPress={confirmarBorrado} disabled={borrar.isPending}>
            <Text style={styles.deleteBtnText}>Eliminar objetivo</Text>
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
  segmentCol: { gap: 8 },
  segBtnCol: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  segBtnSel: { backgroundColor: colors.purple, borderColor: colors.purple },
  segText: { fontSize: 14, color: colors.text, fontWeight: '700' },
  segTextSel: { color: '#fff' },
  diasWrap: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dia: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaSel: { backgroundColor: colors.purple, borderColor: colors.purple },
  diaText: { fontSize: 14, fontWeight: '800', color: colors.text },
  diaTextSel: { color: '#fff' },
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
