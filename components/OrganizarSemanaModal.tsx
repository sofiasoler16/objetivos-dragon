import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { DateTimeField } from '@/components/ui/DateTimeField';
import { spacing, type Tema } from '@/constants/theme';
import {
  crearDesdePropuesta,
  organizarSemana,
  type ObjetivoPropuesto,
  type TareaPropuesta,
} from '@/lib/data';
import {
  type BloqueOcupado,
  ocurrenciasObjetivo,
  ocurrenciasTarea,
  primerConflicto,
} from '@/logic/ia';
import { dateAHora, fechaLarga, horaADate, hoyISO } from '@/logic/fecha';
import { resumenFrecuencia } from '@/logic/objetivos';

const EJEMPLO =
  'Ej: quiero ir al gimnasio un día por semana y empezar a estudiar para una materia que rindo el 15 de agosto, 3 días a la semana, 2 horas por día.';

/** Asegura que hora_fin quede después de hora_inicio (empuja fin +1h si hace falta). */
function ajustarBloque<T extends { hora_inicio: string | null; hora_fin: string | null }>(x: T): T {
  if (x.hora_inicio && x.hora_fin && x.hora_fin <= x.hora_inicio) {
    const [h, m] = x.hora_inicio.split(':').map(Number);
    const fin = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { ...x, hora_fin: fin };
  }
  return x;
}

export function OrganizarSemanaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();

  const [texto, setTexto] = useState('');
  const [generada, setGenerada] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [objetivos, setObjetivos] = useState<ObjetivoPropuesto[]>([]);
  const [tareas, setTareas] = useState<TareaPropuesta[]>([]);
  const [objSel, setObjSel] = useState<boolean[]>([]);
  const [tarSel, setTarSel] = useState<boolean[]>([]);
  const [ocupado, setOcupado] = useState<BloqueOcupado[]>([]);

  const generar = useMutation({
    mutationFn: () => organizarSemana(texto),
    onSuccess: ({ propuesta: p, ocupado: oc }) => {
      setGenerada(true);
      setMensaje(p.mensaje);
      setObjetivos(p.objetivos);
      setTareas(p.tareas);
      setObjSel(p.objetivos.map(() => true));
      setTarSel(p.tareas.map(() => true));
      setOcupado(oc);
    },
    onError: () =>
      Alert.alert('No se pudo generar', 'Revisá tu conexión e intentá de nuevo en un momento.'),
  });

  const agendar = useMutation({
    mutationFn: () =>
      crearDesdePropuesta(
        objetivos.filter((_, i) => objSel[i]),
        tareas.filter((_, i) => tarSel[i]),
      ),
    onSuccess: () => {
      for (const k of [['objetivos'], ['tareas'], ['esperados-hoy'], ['semanales-hoy'], ['agenda-semana']])
        queryClient.invalidateQueries({ queryKey: k });
      Alert.alert('¡Listo! 🐉', 'Agendé lo que elegiste. Ya aparece en tus objetivos y tu semana.');
      cerrar();
    },
    onError: () => Alert.alert('No se pudo agendar', 'Intentá de nuevo.'),
  });

  function cerrar() {
    setTexto('');
    setGenerada(false);
    setMensaje('');
    setObjetivos([]);
    setTareas([]);
    setObjSel([]);
    setTarSel([]);
    setOcupado([]);
    generar.reset();
    onClose();
  }

  // Chequeo de solapamientos EN EL CLIENTE (la IA no es 100% confiable ubicando horarios):
  // cada ítem con horario se compara contra lo ya ocupado + las ocurrencias de los OTROS
  // ítems seleccionados. Devuelve, por ítem, el título con el que choca (o null).
  const { conflObj, conflTar } = useMemo(() => {
    const hoy = hoyISO();
    const ocObj = objetivos.map((o) => ocurrenciasObjetivo(o, hoy));
    const ocTar = tareas.map((t) => ocurrenciasTarea(t));
    const busyDe = (excl: { tipo: 'o' | 't'; i: number }) => {
      const busy: BloqueOcupado[] = [...ocupado];
      objetivos.forEach((_, i) => {
        if (objSel[i] && !(excl.tipo === 'o' && excl.i === i)) busy.push(...ocObj[i]);
      });
      tareas.forEach((_, i) => {
        if (tarSel[i] && !(excl.tipo === 't' && excl.i === i)) busy.push(...ocTar[i]);
      });
      return busy;
    };
    return {
      conflObj: objetivos.map((_, i) =>
        objSel[i] ? primerConflicto(ocObj[i], busyDe({ tipo: 'o', i })) : null,
      ),
      conflTar: tareas.map((_, i) =>
        tarSel[i] ? primerConflicto(ocTar[i], busyDe({ tipo: 't', i })) : null,
      ),
    };
  }, [objetivos, tareas, objSel, tarSel, ocupado]);

  function editarObjHora(i: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setObjetivos((list) => list.map((o, k) => (k === i ? ajustarBloque({ ...o, [campo]: valor }) : o)));
  }
  function editarTarHora(i: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setTareas((list) => list.map((t, k) => (k === i ? ajustarBloque({ ...t, [campo]: valor }) : t)));
  }

  const totalSel = objSel.filter(Boolean).length + tarSel.filter(Boolean).length;
  const sinResultados = generada && objetivos.length === 0 && tareas.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.topRow}>
          <Pressable onPress={cerrar} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.h1}>Organizá mi semana</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!generada && (
            <>
              <Text style={styles.muted}>
                Contame qué querés agregar y te propongo cómo agendarlo. Si algo tiene horario, lo
                agendo como evento en tu semana. Solo sirve para crear objetivos y tareas.
              </Text>
              <TextInput
                style={styles.input}
                value={texto}
                onChangeText={setTexto}
                placeholder={EJEMPLO}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <Pressable
                style={[styles.primaryBtn, (!texto.trim() || generar.isPending) && styles.btnDisabled]}
                onPress={() => generar.mutate()}
                disabled={!texto.trim() || generar.isPending}>
                {generar.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Generar propuesta</Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          {generada && (
            <>
              {!!mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}

              {sinResultados ? (
                <Pressable style={styles.secondaryBtn} onPress={() => setGenerada(false)}>
                  <Text style={styles.secondaryBtnText}>Probar otro pedido</Text>
                </Pressable>
              ) : (
                <>
                  {objetivos.length > 0 && <Text style={styles.seccion}>Objetivos</Text>}
                  {objetivos.map((o, i) => (
                    <Card key={`o${i}`} style={styles.itemCard}>
                      <Pressable
                        style={styles.itemRow}
                        onPress={() => setObjSel((s) => s.map((v, k) => (k === i ? !v : v)))}>
                        <Check on={objSel[i]} colors={colors} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{o.nombre}</Text>
                          <Text style={styles.muted}>
                            {resumenFrecuencia({
                              frecuencia_tipo: o.frecuencia_tipo,
                              frecuencia_cantidad: o.frecuencia_cantidad,
                              dias: o.dias ?? [],
                            })}
                            {o.tipo === 'NUMERIC' && o.meta_valor
                              ? ` · ${o.meta_valor} ${o.unidad ?? ''}`.trimEnd()
                              : ''}
                            {o.fecha_fin ? ` · hasta ${fechaLarga(o.fecha_fin)}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                      {o.hora_inicio && o.hora_fin && (
                        <EditorHora
                          inicio={o.hora_inicio}
                          fin={o.hora_fin}
                          onInicio={(v) => editarObjHora(i, 'hora_inicio', v)}
                          onFin={(v) => editarObjHora(i, 'hora_fin', v)}
                          colors={colors}
                        />
                      )}
                      {conflObj[i] && <AvisoSolape titulo={conflObj[i]!} colors={colors} />}
                    </Card>
                  ))}

                  {tareas.length > 0 && <Text style={styles.seccion}>Tareas</Text>}
                  {tareas.map((t, i) => (
                    <Card key={`t${i}`} style={styles.itemCard}>
                      <Pressable
                        style={styles.itemRow}
                        onPress={() => setTarSel((s) => s.map((v, k) => (k === i ? !v : v)))}>
                        <Check on={tarSel[i]} colors={colors} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{t.titulo}</Text>
                          <Text style={styles.muted}>
                            {t.fecha_limite ? fechaLarga(t.fecha_limite) : 'Sin fecha'} · prioridad{' '}
                            {t.prioridad.toLowerCase()}
                          </Text>
                        </View>
                      </Pressable>
                      {t.hora_inicio && t.hora_fin && (
                        <EditorHora
                          inicio={t.hora_inicio}
                          fin={t.hora_fin}
                          onInicio={(v) => editarTarHora(i, 'hora_inicio', v)}
                          onFin={(v) => editarTarHora(i, 'hora_fin', v)}
                          colors={colors}
                        />
                      )}
                      {conflTar[i] && <AvisoSolape titulo={conflTar[i]!} colors={colors} />}
                    </Card>
                  ))}

                  <Pressable
                    style={[styles.primaryBtn, (totalSel === 0 || agendar.isPending) && styles.btnDisabled]}
                    onPress={() => agendar.mutate()}
                    disabled={totalSel === 0 || agendar.isPending}>
                    {agendar.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        Agendar {totalSel > 0 ? `(${totalSel})` : ''}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable style={styles.linkBtn} onPress={() => setGenerada(false)}>
                    <Text style={styles.linkBtnText}>Empezar de nuevo</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function EditorHora({
  inicio,
  fin,
  onInicio,
  onFin,
  colors,
}: {
  inicio: string;
  fin: string;
  onInicio: (hhmm: string) => void;
  onFin: (hhmm: string) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.horaBox}>
      <Ionicons name="time-outline" size={15} color={colors.purple} />
      <Text style={styles.horaLabel}>Horario</Text>
      <View style={styles.horaFields}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            mode="time"
            value={horaADate(inicio)}
            onChange={(d) => onInicio(dateAHora(d))}
            formato={dateAHora}
          />
        </View>
        <Text style={styles.horaSep}>–</Text>
        <View style={{ flex: 1 }}>
          <DateTimeField
            mode="time"
            value={horaADate(fin)}
            onChange={(d) => onFin(dateAHora(d))}
            formato={dateAHora}
          />
        </View>
      </View>
    </View>
  );
}

function AvisoSolape({ titulo, colors }: { titulo: string; colors: Tema }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.aviso}>
      <Ionicons name="warning-outline" size={15} color={colors.red} />
      <Text style={styles.avisoText}>
        Se superpone con “{titulo}”. Movés la hora arriba para resolverlo.
      </Text>
    </View>
  );
}

function Check({ on, colors }: { on: boolean; colors: Tema }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: on ? colors.green : colors.track,
        backgroundColor: on ? colors.green : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {on && <Ionicons name="checkmark" size={15} color="#fff" />}
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
    scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
    h1: { fontSize: 18, fontWeight: '800', color: colors.text },
    muted: { fontSize: 13, color: colors.textMuted },
    input: {
      minHeight: 130,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 14,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 14,
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    btnDisabled: { opacity: 0.5 },
    secondaryBtn: {
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 999,
      paddingVertical: 12,
    },
    secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
    linkBtn: { alignItems: 'center', paddingVertical: 6 },
    linkBtnText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
    mensaje: { fontSize: 14.5, color: colors.text, fontWeight: '600' },
    seccion: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 4 },
    itemCard: { gap: 10 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemTitle: { fontSize: 14.5, color: colors.text, fontWeight: '600' },
    horaBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    horaLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '700', marginRight: 4 },
    horaFields: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    horaSep: { fontSize: 14, color: colors.textMuted },
    aviso: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.red + '14',
      borderWidth: 1,
      borderColor: colors.redBorder,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    avisoText: { flex: 1, fontSize: 12, color: colors.red, fontWeight: '600' },
  });
