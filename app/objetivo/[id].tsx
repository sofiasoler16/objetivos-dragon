import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
  borrarEspejo,
  dejarDeHacerObjetivo,
  reflejarCorteEnCalendario,
  limpiarEspejosDe,
  compromisosDeContexto,
  crearObjetivo,
  type DiaHorario,
  eliminarObjetivo,
  espejarEnCalendario,
  googleConectado,
  listarCategorias,
  metricaDeUnidad,
  type NuevoObjetivo,
  obtenerObjetivo,
  pedirPermisoCalendario,
  setDiasObjetivo,
  versionarHorario,
} from '@/lib/data';
import {
  dateAHora,
  dateAISO,
  diaSemanaISO,
  fechaLargaConDia,
  horaADate,
  hoyISO,
  isoADate,
  sumarDiasISO,
} from '@/logic/fecha';
import { nombreDia } from '@/logic/agenda';
import { type BloqueOcupado, detalleConflicto } from '@/logic/ia';
import { EMOJIS_OBJETIVO, iconoObjetivo } from '@/logic/iconos';
import { COLORES_CALENDARIO } from '@/logic/coloresCalendario';

type Tipo = 'BOOLEAN' | 'NUMERIC' | 'DURATION';
const TIPO_LABEL: Record<Tipo, string> = { BOOLEAN: 'Sí / No', NUMERIC: 'Numérico', DURATION: 'Duración' };
type Frecuencia = 'DAILY' | 'SPECIFIC_DAYS' | 'WEEKLY_COUNT';
type Rango = { hi: string; hf: string };

const DIAS_NOMBRE = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
/** Suma 1 hora a 'HH:MM' (para que fin > inicio). */
function mas1h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
  const [icono, setIcono] = useState<string | null>(null); // null = automático (detección/categoría)
  const [mostrarIconos, setMostrarIconos] = useState(false); // desplegar la grilla de emojis
  const [tipo, setTipo] = useState<Tipo>('BOOLEAN');
  const [metaValor, setMetaValor] = useState('');
  const [unidad, setUnidad] = useState('');
  const [fuenteHC, setFuenteHC] = useState(false); // pasos automáticos desde Health Connect
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('DAILY');
  const [dias, setDias] = useState<number[]>([]);
  const [cantidad, setCantidad] = useState('');
  const [hora, setHora] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  // Horario (opcional): agenda el objetivo como evento. DAILY = una hora; SPECIFIC_DAYS = por día.
  const [conHorario, setConHorario] = useState(false);
  const [mismaHora, setMismaHora] = useState(true);
  const [horaComun, setHoraComun] = useState<Rango>({ hi: '09:00', hf: '10:00' });
  const [horasDia, setHorasDia] = useState<Record<number, Rango>>({});
  const [color, setColor] = useState<string | null>(null); // colorId de Google (1..11) o null=default

  // Prefill al editar
  useEffect(() => {
    if (!objetivo) return;
    setNombre(objetivo.nombre);
    setDescripcion(objetivo.descripcion ?? '');
    setIdCategoria(objetivo.id_categoria);
    setIcono(objetivo.icono ?? null);
    setColor(objetivo.color ?? null);
    setTipo(objetivo.tipo);
    setMetaValor(objetivo.meta_valor != null ? String(objetivo.meta_valor) : '');
    setUnidad(objetivo.unidad ?? '');
    setFuenteHC(objetivo.fuente_datos === 'HEALTH_CONNECT');
    setFrecuencia(objetivo.frecuencia_tipo);
    setDias(objetivo.dias);
    setCantidad(objetivo.frecuencia_cantidad != null ? String(objetivo.frecuencia_cantidad) : '');
    setHora(objetivo.hora_recordatorio?.slice(0, 5) ?? '');
    setFechaInicio(objetivo.fecha_inicio ?? '');
    setFechaFin(objetivo.fecha_fin ?? '');

    // Prefill del horario (opcional).
    const hi = objetivo.hora_inicio?.slice(0, 5);
    const hf = objetivo.hora_fin?.slice(0, 5);
    const porDia = objetivo.horariosDia.filter((h) => h.hora_inicio && h.hora_fin);
    if (objetivo.frecuencia_tipo === 'DAILY' && hi && hf) {
      setConHorario(true);
      setHoraComun({ hi, hf });
    } else if (objetivo.frecuencia_tipo === 'SPECIFIC_DAYS' && porDia.length > 0) {
      setConHorario(true);
      const mapa: Record<number, Rango> = {};
      porDia.forEach((h) => (mapa[h.dia] = { hi: h.hora_inicio!.slice(0, 5), hf: h.hora_fin!.slice(0, 5) }));
      setHorasDia(mapa);
      const unicas = new Set(porDia.map((h) => `${h.hora_inicio}-${h.hora_fin}`));
      setMismaHora(unicas.size === 1);
      setHoraComun({ hi: porDia[0].hora_inicio!.slice(0, 5), hf: porDia[0].hora_fin!.slice(0, 5) });
    }
  }, [objetivo]);

  const catSel = categorias?.find((c) => c.id_categoria === idCategoria) ?? null;
  const metrica = metricaDeUnidad(unidad);

  // Aviso de solapamiento (al crear a mano): bloques ocupados = otros objetivos con horario +
  // eventos del calendario (excluye este objetivo si se está editando).
  const { data: compromisos } = useQuery({
    queryKey: ['compromisos', esNuevo ? 'nuevo' : id],
    queryFn: () => compromisosDeContexto(14, esNuevo ? undefined : id),
  });
  const conflictoSolape = useMemo<BloqueOcupado | null>(() => {
    if (!conHorario || frecuencia === 'WEEKLY_COUNT') return null;
    const hoy = hoyISO();
    const base = fechaInicio && fechaInicio > hoy ? fechaInicio : hoy;
    const fin = sumarDiasISO(hoy, 14);
    const ocurr: BloqueOcupado[] = [];
    for (let f = base; f < fin; f = sumarDiasISO(f, 1)) {
      if (fechaFin && f > fechaFin) break;
      if (frecuencia === 'DAILY') {
        if (horaComun.hi && horaComun.hf)
          ocurr.push({ titulo: nombre || 'Este objetivo', fecha: f, desde: horaComun.hi, hasta: horaComun.hf });
      } else if (dias.includes(diaSemanaISO(f))) {
        const r = mismaHora ? horaComun : horasDia[diaSemanaISO(f)] ?? horaComun;
        if (r.hi && r.hf)
          ocurr.push({ titulo: nombre || 'Este objetivo', fecha: f, desde: r.hi, hasta: r.hf });
      }
    }
    return detalleConflicto(ocurr, compromisos ?? []);
  }, [conHorario, frecuencia, fechaInicio, fechaFin, horaComun, horasDia, dias, mismaHora, nombre, compromisos]);
  const setMetrica = (m: 'STEPS' | 'CALORIES') => {
    setUnidad(m === 'CALORIES' ? 'kcal' : 'pasos');
    if (!metaValor) setMetaValor(m === 'CALORIES' ? '2000' : '8000');
  };

  // ¿Cambiaron los días o la frecuencia respecto de lo guardado? (para preguntar histórico vs de hoy)
  const horarioCambio = useMemo(() => {
    if (esNuevo || !objetivo) return false;
    if (frecuencia !== objetivo.frecuencia_tipo) return true;
    if (frecuencia === 'SPECIFIC_DAYS') {
      const a = [...dias].sort((x, y) => x - y).join(',');
      const b = [...(objetivo.dias ?? [])].sort((x, y) => x - y).join(',');
      return a !== b;
    }
    return false;
  }, [esNuevo, objetivo, frecuencia, dias]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['objetivos'] });
    // Un objetivo nuevo/editado cambia lo que se espera hoy y la semana → refrescar Hoy.
    queryClient.invalidateQueries({ queryKey: ['esperados-hoy'] });
    queryClient.invalidateQueries({ queryKey: ['semanales-hoy'] });
    queryClient.invalidateQueries({ queryKey: ['objetivos-hc'] }); // por si (des)marcó Health Connect
    // Un cambio de horario afecta el % de los días → refrescar Progreso (días, objetivos, insights…).
    for (const k of [
      'progreso-dias',
      'progreso-objetivos',
      'insights-objs',
      'insights-dias',
      'progreso-mes',
      'progreso-ventana',
      'registros-ventana',
      'progreso-racha',
      'objetivos-vigentes',
    ])
      queryClient.invalidateQueries({ queryKey: [k] });
    if (!esNuevo) queryClient.invalidateQueries({ queryKey: ['objetivo', id] });
  };

  /** Horas de un día puntual (para SPECIFIC_DAYS), respetando "misma hora"/por día. */
  const horaDeDia = (d: number): Rango => {
    if (mismaHora) return horaComun;
    return horasDia[d] ?? horaComun;
  };

  // Espejo al calendario (Google/dispositivo). Se corre en SEGUNDO PLANO tras guardar, porque hace
  // llamadas de red lentas (listar/borrar/crear eventos) que si no trabarían la salida de la pantalla.
  async function sincronizarCalendario(objId: string, payload: NuevoObjetivo) {
    // Al editar, borrar el/los evento(s) espejo viejos (por si cambió el nombre) antes de recrear.
    if (!esNuevo) await borrarEspejo(objetivo?.id_evento_calendario);
    // Defensa anti-duplicados: borra CUALQUIER evento 🐉 con este nombre (incluidos huérfanos).
    await limpiarEspejosDe(payload.nombre);

    // Si tiene horario, asegurar el permiso (no muestra diálogo si ya está concedido). Con Google
    // Calendar conectado los eventos van por su API (no hace falta el permiso del device calendar).
    if (conHorario && frecuencia !== 'WEEKLY_COUNT' && !(await googleConectado())) {
      await pedirPermisoCalendario();
    }
    const base = payload.fecha_inicio ?? hoyISO();
    let idEvento: string | null = null;
    if (conHorario && frecuencia === 'DAILY') {
      idEvento = await espejarEnCalendario({
        frecuencia: 'DAILY',
        titulo: payload.nombre,
        baseISO: base,
        horaInicio: horaComun.hi,
        horaFin: horaComun.hf,
        hastaISO: payload.fecha_fin,
        colorId: color,
      });
    } else if (conHorario && frecuencia === 'SPECIFIC_DAYS') {
      idEvento = await espejarEnCalendario({
        frecuencia: 'SPECIFIC_DAYS',
        titulo: payload.nombre,
        baseISO: base,
        hastaISO: payload.fecha_fin,
        colorId: color,
        dias: dias.map((d) => ({ dia: d, horaInicio: horaDeDia(d).hi, horaFin: horaDeDia(d).hf })),
      });
    }
    await actualizarObjetivo(objId, { id_evento_calendario: idEvento });
    for (const k of [['agenda-semana'], ['agenda-dia'], ['agenda-mes']])
      queryClient.invalidateQueries({ queryKey: k });
  }

  const guardar = useMutation({
    mutationFn: async (modo: 'historico' | 'desde_hoy' | null) => {
      const tieneHoraDaily = conHorario && frecuencia === 'DAILY';
      const payload: NuevoObjetivo = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        id_categoria: idCategoria,
        icono, // null = automático
        color: conHorario ? color : null, // el color es del evento → solo si tiene horario
        tipo,
        frecuencia_tipo: frecuencia,
        frecuencia_cantidad: frecuencia === 'WEEKLY_COUNT' && tipo === 'BOOLEAN' ? Number(cantidad) : null,
        meta_valor: tipo === 'NUMERIC' || tipo === 'DURATION' ? Number(metaValor) : null,
        unidad: tipo === 'DURATION' ? 'min' : tipo === 'NUMERIC' ? unidad.trim() || null : null,
        fuente_datos: tipo === 'NUMERIC' && fuenteHC ? 'HEALTH_CONNECT' : 'MANUAL',
        hora_recordatorio: hora.trim() || null,
        fecha_inicio: fechaInicio || hoyISO(), // fecha LOCAL (no UTC), si no aparecería mañana
        fecha_fin: fechaFin || null,
        hora_inicio: tieneHoraDaily ? horaComun.hi : null,
        hora_fin: tieneHoraDaily ? horaComun.hf : null,
      };

      // Días con su horario (SPECIFIC_DAYS): cada día lleva su hora (o null si no hay horario).
      const diasParam: DiaHorario[] = dias.map((d) => {
        const r = conHorario ? horaDeDia(d) : null;
        return { dia: d, hora_inicio: r?.hi ?? null, hora_fin: r?.hf ?? null };
      });

      let objId = id;
      if (esNuevo) {
        const creado = await crearObjetivo(payload, diasParam);
        objId = creado.id_objetivo;
      } else {
        // Versionar el horario ANTES de pisar objetivo_dia (así la versión base captura los días viejos).
        if (modo) await versionarHorario(id, modo, frecuencia, dias);
        await actualizarObjetivo(id, payload);
        await setDiasObjetivo(id, frecuencia === 'SPECIFIC_DAYS' ? diasParam : []);
      }
      // El espejo al calendario (lento, red) NO se hace acá: se dispara en segundo plano en onSuccess
      // para que el usuario pueda salir de la pantalla al instante.
      return { objId, payload };
    },
    onSuccess: ({ objId, payload }) => {
      invalidar();
      router.back();
      // Sincronización con el calendario EN SEGUNDO PLANO (no bloquea la navegación).
      sincronizarCalendario(objId, payload).catch((e) =>
        console.warn('No se pudo sincronizar el calendario:', e),
      );
    },
    onError: (e) => {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      const msg = err?.message || err?.details || 'No se pudo guardar.';
      Alert.alert('Error al guardar', `${msg}${err?.code ? `\n\n(código ${err.code})` : ''}`);
    },
  });

  const borrar = useMutation({
    mutationFn: () => eliminarObjetivo(id),
    onSuccess: () => {
      invalidar();
      router.back();
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar.'),
  });
  const dejarDeHacer = useMutation({
    mutationFn: () => dejarDeHacerObjetivo(id),
    onSuccess: () => {
      invalidar();
      router.back();
      // El ajuste del calendario (lento, red) va en segundo plano: no traba la salida.
      reflejarCorteEnCalendario(id).catch((e) =>
        console.warn('No se pudo ajustar el calendario:', e),
      );
    },
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.'),
  });

  function validarYGuardar() {
    if (!nombre.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre para el objetivo.');
    if ((tipo === 'NUMERIC' || tipo === 'DURATION') && !(Number(metaValor) > 0))
      return Alert.alert('Meta inválida', tipo === 'DURATION' ? 'Ingresá los minutos (mayor a 0).' : 'Ingresá una meta numérica mayor a 0.');
    if (frecuencia === 'WEEKLY_COUNT' && tipo === 'BOOLEAN' && !(Number(cantidad) > 0))
      return Alert.alert('Cantidad inválida', 'Ingresá cuántas veces por semana (mayor a 0).');
    if (frecuencia === 'SPECIFIC_DAYS' && dias.length === 0)
      return Alert.alert('Elegí los días', 'Seleccioná al menos un día de la semana.');
    if (fechaInicio && fechaFin && fechaFin < fechaInicio)
      return Alert.alert('Fechas inválidas', 'La fecha de fin no puede ser anterior a la de inicio.');
    if (conHorario && frecuencia !== 'WEEKLY_COUNT') {
      const rangos = frecuencia === 'DAILY' || mismaHora ? [horaComun] : dias.map(horaDeDia);
      if (rangos.some((r) => !r.hi || !r.hf || r.hf <= r.hi))
        return Alert.alert('Horario inválido', 'La hora de fin debe ser posterior a la de inicio.');
    }
    // Si cambiaron los días/frecuencia de un objetivo existente, preguntar cómo aplicarlo.
    if (horarioCambio) {
      return Alert.alert(
        'Cambiaste los días',
        '¿Desde cuándo querés que valga este cambio?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'De hoy en adelante', onPress: () => guardar.mutate('desde_hoy') },
          { text: 'A todo el historial', onPress: () => guardar.mutate('historico') },
        ],
      );
    }
    guardar.mutate(null);
  }

  function confirmarBorrado() {
    // NUNCA borra el historial por defecto → dos opciones.
    Alert.alert(`Eliminar "${nombre}"`, '¿Qué querés hacer?', [
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

  if (!esNuevo && isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
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
        <TextInput style={styles.input} placeholder="Ej: Ir al gym" placeholderTextColor={colors.textMuted} value={nombre} onChangeText={setNombre} />

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput style={styles.input} placeholder="Nota corta" placeholderTextColor={colors.textMuted} value={descripcion} onChangeText={setDescripcion} />

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
          <Pressable style={styles.chipNueva} onPress={() => router.push('/categorias')}>
            <Ionicons name="add" size={14} color={colors.purple} />
            <Text style={styles.chipNuevaText}>Nueva</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Ícono</Text>
        <Pressable style={styles.iconoActual} onPress={() => setMostrarIconos((v) => !v)}>
          <View style={styles.iconoActualBadge}>
            <Text style={styles.iconoEmoji}>{iconoObjetivo({ nombre, unidad, icono }, catSel?.icono)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.iconoActualText}>Cambiar ícono</Text>
            <Text style={styles.iconoActualSub}>{icono ? 'Elegido a mano' : 'Automático'}</Text>
          </View>
          <Ionicons name={mostrarIconos ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
        {mostrarIconos && (
          <View style={styles.iconoGrid}>
            <Pressable
              onPress={() => {
                setIcono(null);
                setMostrarIconos(false);
              }}
              style={[styles.iconoCelda, icono === null && styles.iconoCeldaSel]}>
              <Text style={styles.iconoEmoji}>{iconoObjetivo({ nombre, unidad }, catSel?.icono)}</Text>
              <Text style={styles.iconoAutoText}>Auto</Text>
            </Pressable>
            {EMOJIS_OBJETIVO.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  setIcono(e);
                  setMostrarIconos(false);
                }}
                style={[styles.iconoCelda, icono === e && styles.iconoCeldaSel]}>
                <Text style={styles.iconoEmoji}>{e}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Tipo</Text>
        <View style={styles.segment}>
          {(['BOOLEAN', 'NUMERIC', 'DURATION'] as Tipo[]).map((t) => (
            <Pressable key={t} onPress={() => setTipo(t)} style={[styles.segBtn, tipo === t && styles.segBtnSel]}>
              <Text style={[styles.segText, tipo === t && styles.segTextSel]}>{TIPO_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
        {tipo === 'DURATION' && (
          <View>
            <Text style={styles.label}>
              {frecuencia === 'WEEKLY_COUNT' ? 'Meta por semana (minutos)' : 'Meta (minutos)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={metaValor}
              onChangeText={setMetaValor}
            />
            <Text style={styles.hcHelp}>
              {frecuencia === 'WEEKLY_COUNT'
                ? 'Se acumula durante la semana con el cronómetro o los botones.'
                : 'Se mide en minutos y podés usar el cronómetro en Hoy.'}
            </Text>
          </View>
        )}

        {tipo === 'NUMERIC' && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{frecuencia === 'WEEKLY_COUNT' ? 'Meta por semana' : 'Meta'}</Text>
              <TextInput
                style={styles.input}
                placeholder="2000"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={metaValor}
                onChangeText={setMetaValor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unidad</Text>
              <TextInput
                style={[styles.input, fuenteHC && styles.inputDisabled]}
                placeholder="ml, pasos…"
                placeholderTextColor={colors.textMuted}
                value={unidad}
                onChangeText={setUnidad}
                editable={!fuenteHC}
              />
            </View>
          </View>
        )}

        {tipo === 'NUMERIC' && (
          <View style={styles.hcRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.hcTitle}>🔗 Traer de Health Connect</Text>
              <Text style={styles.hcHelp}>
                Los pasos, comidas, etc. se completan solos desde Health Connect (Android). Necesitás una app
                que los registre(Google Fit, Samsung Health…).
              </Text>
            </View>
            <Switch
              value={fuenteHC}
              onValueChange={setFuenteHC}
              trackColor={{ true: colors.purple, false: colors.divider }}
            />
          </View>
        )}

        {tipo === 'NUMERIC' && fuenteHC && (
          <>
            <Text style={styles.label}>¿Qué dato traés?</Text>
            <View style={styles.segment}>
              {(
                [
                  ['STEPS', '👟 Pasos'],
                  ['CALORIES', '🍎 Calorías'],
                ] as ['STEPS' | 'CALORIES', string][]
              ).map(([m, l]) => (
                <Pressable
                  key={m}
                  onPress={() => setMetrica(m)}
                  style={[styles.segBtn, metrica === m && styles.segBtnSel]}>
                  <Text style={[styles.segText, metrica === m && styles.segTextSel]}>{l}</Text>
                </Pressable>
              ))}
            </View>
          </>
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

        {frecuencia === 'WEEKLY_COUNT' && tipo === 'BOOLEAN' && (
          <>
            <Text style={styles.label}>¿Cuántas veces por semana?</Text>
            <TextInput
              style={styles.input}
              placeholder="3"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={cantidad}
              onChangeText={setCantidad}
            />
          </>
        )}
        {frecuencia === 'WEEKLY_COUNT' && tipo !== 'BOOLEAN' && (
          <Text style={styles.hcHelp}>
            📅 La meta de arriba es <Text style={{ fontWeight: '800' }}>por semana</Text>: se acumula
            durante la semana (con el cronómetro o los botones) y no está atada a un día.
          </Text>
        )}

        {frecuencia !== 'WEEKLY_COUNT' && (
          <View style={styles.hcRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.hcTitle}>🕐 Agregar horario</Text>
              <Text style={styles.hcHelp}>
                Con horario, el objetivo se agenda como evento en tu calendario (podés poner una hora
                por día). Sin horario, no se agenda en el calendario.
              </Text>
            </View>
            <Switch
              value={conHorario}
              onValueChange={setConHorario}
              trackColor={{ true: colors.purple, false: colors.divider }}
            />
          </View>
        )}

        {conHorario && frecuencia === 'DAILY' && (
          <RangoHora rango={horaComun} onChange={setHoraComun} colors={colors} />
        )}

        {conHorario && frecuencia === 'SPECIFIC_DAYS' && (
          <>
            <View style={[styles.hcRow, { marginTop: 10 }]}>
              <Text style={[styles.hcTitle, { flex: 1 }]}>Usar horario diferente para cada día</Text>
              <Switch
                value={!mismaHora}
                onValueChange={(v) => setMismaHora(!v)}
                trackColor={{ true: colors.purple, false: colors.divider }}
              />
            </View>
            {mismaHora ? (
              <RangoHora rango={horaComun} onChange={setHoraComun} colors={colors} />
            ) : dias.length === 0 ? (
              <Text style={styles.hcHelp}>Elegí los días arriba para ponerles hora.</Text>
            ) : (
              [...dias]
                .sort((a, b) => a - b)
                .map((d) => (
                  <RangoHora
                    key={d}
                    label={DIAS_NOMBRE[d]}
                    rango={horasDia[d] ?? horaComun}
                    onChange={(r) => setHorasDia((m) => ({ ...m, [d]: r }))}
                    colors={colors}
                  />
                ))
            )}
          </>
        )}

        {conHorario && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Color del evento</Text>
            <View style={styles.colorGrid}>
              <Pressable
                onPress={() => setColor(null)}
                style={[styles.colorAuto, color === null && styles.colorSel]}>
                <Text style={styles.colorAutoText}>Auto</Text>
              </Pressable>
              {COLORES_CALENDARIO.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setColor(c.id)}
                  style={[
                    styles.colorPunto,
                    { backgroundColor: c.hex },
                    color === c.id && styles.colorPuntoSel,
                  ]}
                />
              ))}
            </View>
          </>
        )}

        {conflictoSolape && (
          <View style={styles.solapeBox}>
            <Ionicons name="warning-outline" size={18} color={colors.orange} />
            <Text style={styles.solapeText}>
              Se superpone con “{conflictoSolape.titulo}” — {nombreDia(conflictoSolape.fecha)} de{' '}
              {conflictoSolape.desde} a {conflictoSolape.hasta}. Podés cambiar la hora o guardar igual.
            </Text>
          </View>
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
              formato={(d) => fechaLargaConDia(dateAISO(d))}
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
          formato={(d) => fechaLargaConDia(dateAISO(d))}
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

/** Dos selectores de hora (inicio–fin), con etiqueta opcional de día. Mantiene fin > inicio. */
function RangoHora({
  label,
  rango,
  onChange,
  colors,
}: {
  label?: string;
  rango: Rango;
  onChange: (r: Rango) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const fix = (r: Rango): Rango => (r.hi && r.hf && r.hf <= r.hi ? { ...r, hf: mas1h(r.hi) } : r);
  return (
    <View style={styles.rangoRow}>
      {label && <Text style={styles.rangoLabel}>{label}</Text>}
      <View style={{ flex: 1 }}>
        <DateTimeField
          mode="time"
          value={horaADate(rango.hi)}
          onChange={(d) => onChange(fix({ ...rango, hi: dateAHora(d) }))}
          placeholder="Inicio"
          formato={dateAHora}
        />
      </View>
      <Text style={styles.rangoSep}>–</Text>
      <View style={{ flex: 1 }}>
        <DateTimeField
          mode="time"
          value={horaADate(rango.hf)}
          onChange={(d) => onChange(fix({ ...rango, hf: dateAHora(d) }))}
          placeholder="Fin"
          formato={dateAHora}
        />
      </View>
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
  chipNueva: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.purple,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  chipNuevaText: { fontSize: 13, color: colors.purple, fontWeight: '800' },
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
  iconoActual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: 10,
  },
  iconoActualBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.purple + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoActualText: { fontSize: 14, fontWeight: '700', color: colors.text },
  iconoActualSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  iconoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  iconoCelda: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoCeldaSel: { borderColor: colors.purple, borderWidth: 2, backgroundColor: colors.purple + '18' },
  iconoEmoji: { fontSize: 22 },
  iconoAutoText: { fontSize: 8.5, fontWeight: '800', color: colors.textMuted, marginTop: 1 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, alignItems: 'center' },
  colorPunto: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorPuntoSel: { borderColor: colors.text },
  colorAuto: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorAutoText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  colorSel: { borderColor: colors.purple, backgroundColor: colors.purple + '18' },
  hcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  hcTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  hcHelp: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  solapeBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.orange + '18',
    borderRadius: radius.md,
    padding: 12,
    marginTop: 12,
  },
  solapeText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  inputDisabled: { opacity: 0.6 },
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
  rangoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rangoLabel: { width: 76, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  rangoSep: { fontSize: 16, color: colors.textMuted },
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
