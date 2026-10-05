import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  type Categoria,
  crearDesdePropuesta,
  LimiteIAError,
  listarCategorias,
  organizarSemana,
  usoIaActual,
  type ObjetivoPropuesto,
  type TareaPropuesta,
} from '@/lib/data';
import { type BloqueOcupado, detalleConflicto, ocurrenciasObjetivo, type Prioridad } from '@/logic/ia';
import { nombreDia } from '@/logic/agenda';
import { dateAHora, dateAISO, fechaLarga, horaADate, isoADate, hoyISO } from '@/logic/fecha';
import { resumenFrecuencia } from '@/logic/objetivos';
import { detenerDictado, iniciarDictado, vozDisponible } from '@/lib/voz';

const EJEMPLO =
  'Ej: quiero ir al gimnasio un día por semana y empezar a estudiar para una materia que rindo el 15 de agosto, 3 días a la semana, 2 horas por día.';

const DIAS_CORTO = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

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
  // Qué tarjetas tienen abierto el panel de edición (índices). Objetivos y tareas por separado.
  const [objEdit, setObjEdit] = useState<Set<number>>(new Set());
  const [tarEdit, setTarEdit] = useState<Set<number>>(new Set());

  // Categorías del usuario, para poder reasignar la categoría de cada propuesta.
  const { data: categorias = [] } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });

  // Dictado por voz (nativo → solo aparece en el rebuild; en el dev-client vozDisponible()=false).
  const [escuchando, setEscuchando] = useState(false);
  const baseTexto = useRef('');
  const mostrarMic = vozDisponible();

  const onMic = async () => {
    if (escuchando) {
      detenerDictado();
      setEscuchando(false);
      return;
    }
    // Lo dictado se AGREGA a lo que ya haya escrito.
    baseTexto.current = texto.trim() ? texto.trimEnd() + ' ' : '';
    const ok = await iniciarDictado({
      onParcial: (t) => setTexto(baseTexto.current + t),
      onFinal: (t) => {
        const nuevo = baseTexto.current + t;
        setTexto(nuevo);
        baseTexto.current = nuevo.trimEnd() + ' ';
      },
      onFin: () => setEscuchando(false),
      onError: (motivo) => {
        setEscuchando(false);
        if (motivo === 'sin-permiso')
          Alert.alert('Permiso de micrófono', 'Activá el micrófono para poder dictar por voz.');
        else if (motivo === 'no-disponible')
          Alert.alert(
            'No disponible',
            'Tu teléfono no tiene reconocimiento de voz disponible. Podés escribir el pedido a mano.',
          );
        // otros errores (ej. "no se entendió") se ignoran en silencio
      },
    });
    if (ok) setEscuchando(true);
  };

  // Cortar la escucha si el modal se cierra; y al desmontar.
  useEffect(() => {
    if (!visible) {
      detenerDictado();
      setEscuchando(false);
    }
  }, [visible]);
  useEffect(() => () => detenerDictado(), []);

  // Contador de uso de la IA del mes ("N/límite"). Server-side; se refresca al generar.
  const { data: uso } = useQuery({ queryKey: ['uso-ia'], queryFn: usoIaActual });

  const generar = useMutation({
    mutationFn: () => organizarSemana(texto),
    onSuccess: ({ propuesta: p, ocupado: oc }) => {
      setGenerada(true);
      setMensaje(p.mensaje);
      setObjetivos(p.objetivos);
      setTareas(p.tareas);
      setObjSel(p.objetivos.map(() => true));
      setTarSel(p.tareas.map(() => true));
      setObjEdit(new Set());
      setTarEdit(new Set());
      setOcupado(oc);
      queryClient.invalidateQueries({ queryKey: ['uso-ia'] }); // consumió 1 uso
    },
    onError: (e) => {
      queryClient.invalidateQueries({ queryKey: ['uso-ia'] });
      if (e instanceof LimiteIAError) {
        Alert.alert(
          'Llegaste al límite del mes',
          `Usaste tus ${e.limite} consultas de IA de este mes. El contador se reinicia el mes que viene 🐉`,
        );
        return;
      }
      Alert.alert('No se pudo generar', 'Revisá tu conexión e intentá de nuevo en un momento.');
    },
  });

  const agendar = useMutation({
    mutationFn: () =>
      crearDesdePropuesta(
        // 🔒 red de seguridad: un NUMERIC sin meta (si la vaciaron al editar) cae a 1.
        objetivos
          .filter((_, i) => objSel[i])
          .map((o) => (o.tipo === 'NUMERIC' && !o.meta_valor ? { ...o, meta_valor: 1 } : o)),
        tareas.filter((_, i) => tarSel[i]),
      ),
    onSuccess: () => {
      for (const k of [['objetivos'], ['tareas'], ['esperados-hoy'], ['semanales-hoy'], ['agenda-semana'], ['agenda-dia'], ['agenda-mes']])
        queryClient.invalidateQueries({ queryKey: k });
      Alert.alert('¡Listo! 🐉', 'Agendé lo que elegiste. Ya aparece en tus objetivos y tu semana.');
      cerrar();
    },
    onError: () => Alert.alert('No se pudo agendar', 'Intentá de nuevo.'),
  });

  function cerrar() {
    detenerDictado();
    setEscuchando(false);
    setTexto('');
    setGenerada(false);
    setMensaje('');
    setObjetivos([]);
    setTareas([]);
    setObjSel([]);
    setTarSel([]);
    setOcupado([]);
    setObjEdit(new Set());
    setTarEdit(new Set());
    generar.reset();
    onClose();
  }

  // Abrir/cerrar el panel de edición de una tarjeta.
  function toggleObjEdit(i: number) {
    setObjEdit((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }
  function toggleTarEdit(i: number) {
    setTarEdit((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }
  // Editar campos sueltos de un objetivo/tarea propuestos (se guardan en el estado y se agendan así).
  function editarObjCampo(i: number, patch: Partial<ObjetivoPropuesto>) {
    setObjetivos((list) => list.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  }
  function editarTarCampo(i: number, patch: Partial<TareaPropuesta>) {
    setTareas((list) => list.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  }

  // Chequeo de solapamientos EN EL CLIENTE (la IA no es 100% confiable ubicando horarios):
  // cada ítem con horario se compara contra lo ya ocupado + las ocurrencias de los OTROS
  // ítems seleccionados. Devuelve, por ítem, el título con el que choca (o null).
  // Solo los OBJETIVOS tienen horario (las tareas no). Cada objetivo se compara contra lo ya
  // ocupado + las ocurrencias de los otros objetivos seleccionados.
  const conflObj = useMemo(() => {
    const hoy = hoyISO();
    const ocObj = objetivos.map((o) => ocurrenciasObjetivo(o, hoy));
    return objetivos.map((_, i) => {
      if (!objSel[i]) return null;
      const busy: BloqueOcupado[] = [...ocupado];
      objetivos.forEach((__, j) => {
        if (objSel[j] && j !== i) busy.push(...ocObj[j]);
      });
      const d = detalleConflicto(ocObj[i], busy);
      // Aviso ESPECÍFICO: con qué choca, qué día y a qué hora (no genérico).
      return d ? `Se superpone con “${d.titulo}” el ${nombreDia(d.fecha).toLowerCase()} de ${d.desde} a ${d.hasta}.` : null;
    });
  }, [objetivos, objSel, ocupado]);

  function editarObjHora(i: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setObjetivos((list) => list.map((o, k) => (k === i ? ajustarBloque({ ...o, [campo]: valor }) : o)));
  }
  function editarObjDia(i: number, dia: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setObjetivos((list) =>
      list.map((o, k) =>
        k === i
          ? {
              ...o,
              horarios_dia: (o.horarios_dia ?? []).map((h) =>
                h.dia === dia ? ajustarBloque({ ...h, [campo]: valor }) : h,
              ),
            }
          : o,
      ),
    );
  }
  const totalSel = objSel.filter(Boolean).length + tarSel.filter(Boolean).length;
  const sinResultados = generada && objetivos.length === 0 && tareas.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Pressable onPress={cerrar} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.h1}>Organizá mi semana</Text>
          <View style={{ width: 24 }} />
        </View>

        {uso && (
          <Text style={styles.contadorIa}>
            {uso.usados}/{uso.limite} consultas de IA este mes
          </Text>
        )}

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!generada && (
            <>
              <View style={styles.guia}>
                <Text style={styles.guiaTitulo}>Contame qué querés hacer y te lo agendo:</Text>
                <Text style={styles.guiaLinea}>
                  <Text style={styles.guiaBold}>📌 Tarea</Text> — algo de un solo día. Ej:{' '}
                  <Text style={styles.guiaItalic}>“entregar el informe el viernes a las 14”</Text>.
                </Text>
                <Text style={styles.guiaLinea}>
                  <Text style={styles.guiaBold}>🔁 Objetivo</Text> — un hábito que se repite. Ej:{' '}
                  <Text style={styles.guiaItalic}>“gimnasio lunes y miércoles a las 18”</Text>.
                </Text>
                <Text style={styles.guiaLinea}>
                  💡 Decime la <Text style={styles.guiaBold}>hora</Text> si querés que quede en tu
                  calendario. Sin hora, no se agenda ahí.
                </Text>
              </View>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, mostrarMic && styles.inputConMic]}
                  value={texto}
                  onChangeText={setTexto}
                  placeholder={EJEMPLO}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
                {mostrarMic && (
                  <Pressable
                    onPress={onMic}
                    hitSlop={8}
                    style={[styles.micBtn, escuchando && styles.micBtnOn]}>
                    <Ionicons
                      name={escuchando ? 'mic' : 'mic-outline'}
                      size={20}
                      color={escuchando ? '#fff' : colors.purple}
                    />
                  </Pressable>
                )}
              </View>
              {escuchando && <Text style={styles.escuchandoTxt}>🎙️ Escuchando… tocá el micrófono para parar</Text>}
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
                            {o.id_categoria
                              ? ` · ${categorias.find((c) => c.id_categoria === o.id_categoria)?.nombre ?? ''}`.trimEnd()
                              : ''}
                            {o.fecha_fin ? ` · hasta ${fechaLarga(o.fecha_fin)}` : ''}
                          </Text>
                        </View>
                        <BotonEditar abierto={objEdit.has(i)} onPress={() => toggleObjEdit(i)} colors={colors} />
                      </Pressable>

                      {objEdit.has(i) && (
                        <View style={styles.editPanel}>
                          <CampoTexto
                            label="Nombre"
                            value={o.nombre}
                            onChange={(v) => editarObjCampo(i, { nombre: v })}
                            colors={colors}
                          />
                          {o.tipo === 'NUMERIC' && (
                            <View style={styles.filaMeta}>
                              <View style={{ flex: 1 }}>
                                <CampoTexto
                                  label="Meta"
                                  value={o.meta_valor != null ? String(o.meta_valor) : ''}
                                  onChange={(v) => {
                                    const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                                    editarObjCampo(i, { meta_valor: Number.isFinite(n) && n > 0 ? n : null });
                                  }}
                                  keyboardType="number-pad"
                                  colors={colors}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <CampoTexto
                                  label="Unidad"
                                  value={o.unidad ?? ''}
                                  onChange={(v) => editarObjCampo(i, { unidad: v.trim() || null })}
                                  placeholder="ej. pasos, ml"
                                  colors={colors}
                                />
                              </View>
                            </View>
                          )}
                          <SelectorCategoria
                            categorias={categorias}
                            valor={o.id_categoria}
                            onChange={(id) => editarObjCampo(i, { id_categoria: id })}
                            colors={colors}
                          />
                        </View>
                      )}

                      {o.frecuencia_tipo === 'DAILY' && o.hora_inicio && o.hora_fin && (
                        <EditorHora
                          inicio={o.hora_inicio}
                          fin={o.hora_fin}
                          onInicio={(v) => editarObjHora(i, 'hora_inicio', v)}
                          onFin={(v) => editarObjHora(i, 'hora_fin', v)}
                          colors={colors}
                        />
                      )}
                      {o.frecuencia_tipo === 'SPECIFIC_DAYS' &&
                        (o.horarios_dia ?? []).map((h) => (
                          <EditorHora
                            key={h.dia}
                            label={DIAS_CORTO[h.dia]}
                            inicio={h.hora_inicio}
                            fin={h.hora_fin}
                            onInicio={(v) => editarObjDia(i, h.dia, 'hora_inicio', v)}
                            onFin={(v) => editarObjDia(i, h.dia, 'hora_fin', v)}
                            colors={colors}
                          />
                        ))}
                      {conflObj[i] && <AvisoSolape mensaje={conflObj[i]!} colors={colors} />}
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
                            {t.id_categoria
                              ? ` · ${categorias.find((c) => c.id_categoria === t.id_categoria)?.nombre ?? ''}`.trimEnd()
                              : ''}
                          </Text>
                        </View>
                        <BotonEditar abierto={tarEdit.has(i)} onPress={() => toggleTarEdit(i)} colors={colors} />
                      </Pressable>

                      {tarEdit.has(i) && (
                        <View style={styles.editPanel}>
                          <CampoTexto
                            label="Título"
                            value={t.titulo}
                            onChange={(v) => editarTarCampo(i, { titulo: v })}
                            colors={colors}
                          />
                          <View style={styles.campo}>
                            <Text style={styles.campoLabel}>Fecha límite</Text>
                            <DateTimeField
                              mode="date"
                              value={isoADate(t.fecha_limite)}
                              onChange={(d) => editarTarCampo(i, { fecha_limite: dateAISO(d) })}
                              formato={(d) => fechaLarga(dateAISO(d))}
                              placeholder="Sin fecha"
                            />
                          </View>
                          <SelectorPrioridad
                            valor={t.prioridad}
                            onChange={(p) => editarTarCampo(i, { prioridad: p })}
                            colors={colors}
                          />
                          <SelectorCategoria
                            categorias={categorias}
                            valor={t.id_categoria}
                            onChange={(id) => editarTarCampo(i, { id_categoria: id })}
                            colors={colors}
                          />
                        </View>
                      )}
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

/** Botón lápiz que abre/cierra el panel de edición de una tarjeta. */
function BotonEditar({ abierto, onPress, colors }: { abierto: boolean; onPress: () => void; colors: Tema }) {
  const styles = makeStyles(colors);
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.editBtn}>
      <Ionicons name={abierto ? 'checkmark' : 'pencil'} size={15} color={colors.purple} />
      <Text style={styles.editBtnText}>{abierto ? 'Listo' : 'Editar'}</Text>
    </Pressable>
  );
}

/** Campo de texto etiquetado para el panel de edición. */
function CampoTexto({
  label,
  value,
  onChange,
  colors,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: Tema;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput
        style={styles.campoInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

/** Selector de categoría en chips (incluye "Sin categoría"). */
function SelectorCategoria({
  categorias,
  valor,
  onChange,
  colors,
}: {
  categorias: Categoria[];
  valor: string | null;
  onChange: (id: string | null) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>Categoría</Text>
      <View style={styles.chipsWrap}>
        <Chip texto="Sin categoría" activo={valor == null} onPress={() => onChange(null)} colors={colors} />
        {categorias.map((c) => (
          <Chip
            key={c.id_categoria}
            texto={c.nombre}
            activo={valor === c.id_categoria}
            onPress={() => onChange(c.id_categoria)}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

/** Selector de prioridad (baja/media/alta) para tareas. */
function SelectorPrioridad({
  valor,
  onChange,
  colors,
}: {
  valor: Prioridad;
  onChange: (p: Prioridad) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const opciones: { p: Prioridad; t: string }[] = [
    { p: 'BAJA', t: 'Baja' },
    { p: 'MEDIA', t: 'Media' },
    { p: 'ALTA', t: 'Alta' },
  ];
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>Prioridad</Text>
      <View style={styles.chipsWrap}>
        {opciones.map((o) => (
          <Chip key={o.p} texto={o.t} activo={valor === o.p} onPress={() => onChange(o.p)} colors={colors} />
        ))}
      </View>
    </View>
  );
}

/** Chip seleccionable reutilizable (categoría / prioridad). */
function Chip({
  texto,
  activo,
  onPress,
  colors,
}: {
  texto: string;
  activo: boolean;
  onPress: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  return (
    <Pressable onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
      <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{texto}</Text>
    </Pressable>
  );
}

function EditorHora({
  inicio,
  fin,
  onInicio,
  onFin,
  colors,
  label = 'Horario',
}: {
  inicio: string;
  fin: string;
  onInicio: (hhmm: string) => void;
  onFin: (hhmm: string) => void;
  colors: Tema;
  label?: string;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.horaBox}>
      <Ionicons name="time-outline" size={15} color={colors.purple} />
      <Text style={styles.horaLabel}>{label}</Text>
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

function AvisoSolape({ mensaje, colors }: { mensaje: string; colors: Tema }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.aviso}>
      <Ionicons name="warning-outline" size={15} color={colors.red} />
      <Text style={styles.avisoText}>{mensaje} Movés la hora arriba para resolverlo.</Text>
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
    contadorIa: { textAlign: 'center', fontSize: 11.5, color: colors.textMuted, fontWeight: '700', paddingBottom: 4 },
    muted: { fontSize: 13, color: colors.textMuted },
    guia: {
      gap: 7,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
    },
    guiaTitulo: { fontSize: 13.5, fontWeight: '800', color: colors.text, marginBottom: 1 },
    guiaLinea: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    guiaBold: { fontWeight: '800', color: colors.text },
    guiaItalic: { fontStyle: 'italic', color: colors.text },
    inputWrap: { position: 'relative' },
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
    inputConMic: { paddingRight: 52 }, // espacio para que el texto no quede bajo el micrófono
    micBtn: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.purple100,
    },
    micBtnOn: { backgroundColor: colors.purple },
    escuchandoTxt: { fontSize: 12.5, color: colors.purple, fontWeight: '700', marginTop: 6, textAlign: 'center' },
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
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingLeft: 6 },
    editBtnText: { fontSize: 12.5, color: colors.purple, fontWeight: '700' },
    editPanel: {
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: 10,
    },
    filaMeta: { flexDirection: 'row', gap: 10 },
    campo: { gap: 5 },
    campoLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    campoInput: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14.5,
      color: colors.text,
      backgroundColor: colors.bg,
    },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    chip: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActivo: { backgroundColor: colors.purple, borderColor: colors.purple },
    chipText: { fontSize: 12.5, color: colors.text, fontWeight: '600' },
    chipTextActivo: { color: '#fff' },
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
