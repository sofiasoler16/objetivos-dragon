import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RazonOmisionModal } from '@/components/RazonOmisionModal';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import {
  dejarDeHacerObjetivo,
  eliminarObjetivo,
  esErrorDeRed,
  esperadosHoy,
  guardarOmitir,
  listarCategorias,
  obtenerObjetivo,
  omitirYReflejar,
} from '@/lib/data';
import { fechaLarga, fechaLargaConDia, hoyISO } from '@/logic/fecha';
import { type EsperadoHoy, formatearMinutos } from '@/logic/hoy';
import { resumenFrecuencia } from '@/logic/objetivos';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null);

export default function ObjetivoInfoScreen() {
  const { id, fecha: fechaParam } = useLocalSearchParams<{ id: string; fecha?: string }>();
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();

  // Día al que se refiere el "omitir" (viene de Hoy). Por defecto = hoy.
  const hoy = hoyISO();
  const fecha = fechaParam ?? hoy;
  const esHoy = fecha === hoy;

  const { data: objetivo, isLoading } = useQuery({
    queryKey: ['objetivo', id],
    queryFn: () => obtenerObjetivo(id),
  });
  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  // Estado del objetivo en el día (para saber si está omitido y poder omitir/deshacer).
  const { data: esperados } = useQuery({
    queryKey: ['esperados-hoy', fecha],
    queryFn: () => esperadosHoy(undefined, esHoy ? undefined : fecha),
  });
  const estadoDia = esperados?.find((o) => o.id_objetivo === id);

  const [razonAbierta, setRazonAbierta] = useState(false);
  const omitir = useMutation({
    mutationFn: async ({ omitir, razon }: { omitir: boolean; razon?: string | null }) => {
      // Online refleja también al calendario; sin red, encolamos solo el registro de la base.
      try {
        await omitirYReflejar(id, fecha, omitir, razon);
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        await guardarOmitir(id, fecha, omitir, razon);
      }
    },
    onMutate: async ({ omitir }) => {
      // Optimista: el estado omitido cambia al instante (también offline).
      await queryClient.cancelQueries({ queryKey: ['esperados-hoy', fecha] });
      const prev = queryClient.getQueryData<EsperadoHoy[]>(['esperados-hoy', fecha]);
      queryClient.setQueryData<EsperadoHoy[]>(['esperados-hoy', fecha], (old) =>
        (old ?? []).map((o) => (o.id_objetivo === id ? { ...o, omitido: omitir } : o)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['esperados-hoy', fecha], ctx.prev);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo.');
    },
    onSettled: () => {
      for (const k of [
        ['esperados-hoy'],
        ['progreso-dias'],
        ['progreso-objetivos'],
        ['progreso-mes'],
        ['detalle-dia'],
        ['agenda-semana'],
        ['agenda-dia'],
        ['agenda-mes'],
        ['pendientes'],
      ])
        queryClient.invalidateQueries({ queryKey: k });
    },
  });
  const invalidarBorrado = () => {
    for (const k of [['objetivos'], ['esperados-hoy'], ['semanales-hoy'], ['progreso-dias'], ['progreso-mes'], ['detalle-dia'], ['agenda-semana'], ['agenda-dia'], ['agenda-mes']])
      queryClient.invalidateQueries({ queryKey: k });
    router.back();
  };
  const borrar = useMutation({
    mutationFn: () => eliminarObjetivo(id),
    onSuccess: invalidarBorrado,
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar.'),
  });
  const dejarDeHacer = useMutation({
    mutationFn: () => dejarDeHacerObjetivo(id),
    onSuccess: invalidarBorrado,
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.'),
  });
  function confirmarBorrado() {
    // NUNCA borra el historial por defecto → dos opciones.
    Alert.alert(`Eliminar "${objetivo?.nombre ?? ''}"`, '¿Qué querés hacer?', [
      { text: 'Dejar de hacerlo (de hoy en adelante)', onPress: () => dejarDeHacer.mutate() },
      {
        text: 'Eliminar todo (incluido el historial)',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            '¿Seguro?',
            'Se borra el objetivo y TODO su historial de cumplimiento. No se puede deshacer.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar todo', style: 'destructive', onPress: () => borrar.mutate() },
            ],
          ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (!objetivo) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <Encabezado colors={colors} titulo="Objetivo" />
        <Text style={styles.muted}>No encontramos este objetivo.</Text>
      </SafeAreaView>
    );
  }

  const cat = categorias?.find((c) => c.id_categoria === objetivo.id_categoria);
  const tipoTxt =
    objetivo.tipo === 'DURATION'
      ? `Duración · meta ${formatearMinutos(objetivo.meta_valor ?? 0)}`
      : objetivo.tipo === 'NUMERIC'
        ? `Numérico · meta ${objetivo.meta_valor ?? '?'} ${objetivo.unidad ?? ''}`.trim()
        : 'Sí / No';

  // Horario: DAILY = una hora; SPECIFIC_DAYS = por día.
  const horarioLineas: string[] = [];
  if (objetivo.frecuencia_tipo === 'DAILY' && hhmm(objetivo.hora_inicio) && hhmm(objetivo.hora_fin))
    horarioLineas.push(`${hhmm(objetivo.hora_inicio)}–${hhmm(objetivo.hora_fin)}`);
  else if (objetivo.frecuencia_tipo === 'SPECIFIC_DAYS')
    for (const h of objetivo.horariosDia)
      if (hhmm(h.hora_inicio) && hhmm(h.hora_fin))
        horarioLineas.push(`${DIAS[h.dia]}: ${hhmm(h.hora_inicio)}–${hhmm(h.hora_fin)}`);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Encabezado colors={colors} titulo="Objetivo" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.nombre}>{objetivo.nombre}</Text>
        {cat && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {cat.icono} {cat.nombre}
            </Text>
          </View>
        )}

        <Card style={styles.card}>
          {objetivo.descripcion ? <Fila colors={colors} etiqueta="Descripción" valor={objetivo.descripcion} /> : null}
          <Fila colors={colors} etiqueta="Tipo" valor={tipoTxt} />
          <Fila colors={colors} etiqueta="Frecuencia" valor={resumenFrecuencia(objetivo)} />
          <Fila
            colors={colors}
            etiqueta="Horario"
            valor={horarioLineas.length ? horarioLineas.join('\n') : 'Sin horario'}
          />
          {objetivo.hora_recordatorio ? (
            <Fila colors={colors} etiqueta="Recordatorio" valor={hhmm(objetivo.hora_recordatorio)!} />
          ) : null}
          <Fila
            colors={colors}
            etiqueta="Empieza"
            valor={objetivo.fecha_inicio ? fechaLarga(objetivo.fecha_inicio.slice(0, 10)) : '—'}
          />
          <Fila
            colors={colors}
            etiqueta="Termina"
            valor={objetivo.fecha_fin ? fechaLarga(objetivo.fecha_fin.slice(0, 10)) : 'Sin fecha de fin'}
          />
          {objetivo.tipo === 'NUMERIC' ? (
            <Fila
              colors={colors}
              etiqueta="Datos"
              valor={objetivo.fuente_datos === 'HEALTH_CONNECT' ? 'Health Connect (automático)' : 'Manual'}
              ultima
            />
          ) : null}
        </Card>

        {/* Omitir por el día: excluye el objetivo del % (no cuenta ni suma ni resta). */}
        {estadoDia && (
          estadoDia.omitido ? (
            <Pressable
              style={styles.omitirBtn}
              disabled={omitir.isPending}
              onPress={() => omitir.mutate({ omitir: false })}>
              <Ionicons name="refresh-outline" size={18} color={colors.purple} />
              <Text style={styles.omitirBtnText}>Quitar omisión ({esHoy ? 'hoy' : fechaLargaConDia(fecha)})</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.omitirBtn}
              disabled={omitir.isPending}
              onPress={() => setRazonAbierta(true)}>
              <Ionicons name="remove-circle-outline" size={18} color={colors.purple} />
              <Text style={styles.omitirBtnText}>Omitir {esHoy ? 'hoy' : `el ${fechaLargaConDia(fecha)}`}</Text>
            </Pressable>
          )
        )}
        {estadoDia && !estadoDia.omitido && (
          <Text style={styles.omitirHelp}>
            Omitir excluye este objetivo del % del día (no cuenta ni a favor ni en contra).
          </Text>
        )}

        <Pressable style={styles.editBtn} onPress={() => router.push(`/objetivo/${id}`)}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.editBtnText}>Editar objetivo</Text>
        </Pressable>

        <Pressable style={styles.borrarBtn} disabled={borrar.isPending} onPress={confirmarBorrado}>
          <Ionicons name="trash-outline" size={17} color={colors.red} />
          <Text style={styles.borrarBtnText}>Eliminar el objetivo…</Text>
        </Pressable>
      </ScrollView>

      <RazonOmisionModal
        visible={razonAbierta}
        nombre={objetivo.nombre}
        onCancelar={() => setRazonAbierta(false)}
        onConfirmar={(razon) => {
          setRazonAbierta(false);
          omitir.mutate({ omitir: true, razon });
        }}
      />
    </SafeAreaView>
  );
}

function Encabezado({ colors, titulo }: { colors: Tema; titulo: string }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.topRow}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.h1}>{titulo}</Text>
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
    omitirBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 14,
      paddingVertical: 13,
      marginTop: 4,
    },
    omitirBtnText: { color: colors.purple, fontSize: 15, fontWeight: '800' },
    omitirHelp: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: -4 },
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
    borrarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    borrarBtnText: { color: colors.red, fontSize: 14.5, fontWeight: '800' },
  });
