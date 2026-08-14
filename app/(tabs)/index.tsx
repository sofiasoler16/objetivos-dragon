import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonButton } from '@/components/DragonButton';
import { DragonHero } from '@/components/DragonHero';
import { ProfileButton } from '@/components/ProfileButton';
import { StatsPills } from '@/components/StatsPills';
import { useTheme } from '@/components/theme-provider';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';
import { useRevisarLogros } from '@/hooks/useRevisarLogros';
import { useSession } from '@/components/session-provider';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  comidasDeHoy,
  completarTarea,
  esperadosHoy,
  listarCategorias,
  listarTareas,
  marcarObjetivoCompletado,
  metricaDeUnidad,
  objetivosHealthConnect,
  omitirObjetivo,
  registrarValorNumerico,
  semanalesHoy,
  sincronizarHealthConnect,
} from '@/lib/data';
import { estadoDragon, mensajeDragon } from '@/logic/dragon';
import { hoyISO, horaActual, sumarDiasISO } from '@/logic/fecha';
import { creditoObjetivo, type EsperadoHoy, pasosNumericos, porcentajeDia } from '@/logic/hoy';

/** Formatea un número sin decimales sobrantes (250 → "250", 2.5 → "2,5"). */
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// MealType de Health Connect (0=desconocido, 1=desayuno, 2=almuerzo, 3=cena, 4=snack).
const etiquetaComida = (t: number) =>
  ({ 1: 'Desayuno', 2: 'Almuerzo', 3: 'Cena', 4: 'Snack' })[t] ?? 'Comida';

export default function HoyScreen() {
  const queryClient = useQueryClient();
  const revisarLogros = useRevisarLogros();
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { session } = useSession();
  const assetKeyDragon = useDragonEquipado();
  const email = session?.user.email ?? '';
  const nombre = (session?.user.user_metadata?.nombre as string) || email.split('@')[0] || 'crack';

  const hoy = hoyISO();
  const manana = sumarDiasISO(hoy, 1);

  const {
    data: esperados,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['esperados-hoy'], queryFn: () => esperadosHoy() });
  const { data: semanales } = useQuery({ queryKey: ['semanales-hoy'], queryFn: () => semanalesHoy() });
  const { data: tareas } = useQuery({ queryKey: ['tareas'], queryFn: () => listarTareas() });
  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  const catMap = new Map((categorias ?? []).map((c) => [c.id_categoria, c]));
  // Objetivos que se autocompletan desde Health Connect (para marcarlos en la UI).
  const { data: hcObjetivos } = useQuery({ queryKey: ['objetivos-hc'], queryFn: objetivosHealthConnect });
  const hcIds = new Set((hcObjetivos ?? []).map((o) => o.id_objetivo));

  const lista = esperados ?? [];
  const booleanos = lista.filter((o) => o.tipo === 'BOOLEAN');
  const numericos = lista.filter((o) => o.tipo === 'NUMERIC');
  const percent = porcentajeDia(lista);
  const estado = estadoDragon(percent, horaActual());
  const mensaje = mensajeDragon(estado);
  const finSemana = sumarDiasISO(hoy, 7);
  // Hoy: vencen hoy (marcadas o no, para que no desaparezcan) o vencidas sin completar.
  const tareasHoy = (tareas ?? []).filter(
    (t) => t.fecha_limite && (t.fecha_limite === hoy || (!t.completada && t.fecha_limite < hoy)),
  );
  // Próximas: de mañana hasta 7 días, sin completar.
  const tareasProximas = (tareas ?? []).filter(
    (t) => !t.completada && t.fecha_limite && t.fecha_limite > hoy && t.fecha_limite <= finSemana,
  );

  // Modal para crear un botón nuevo (valor personalizado) de un objetivo numérico.
  const [editando, setEditando] = useState<EsperadoHoy | null>(null);
  const [texto, setTexto] = useState('');

  // Modal con el detalle de comidas de hoy (Health Connect) del objetivo de calorías.
  const [detalleComidas, setDetalleComidas] = useState(false);
  const { data: comidasRes, isFetching: comidasFetching } = useQuery({
    queryKey: ['comidas-hoy'],
    queryFn: () => comidasDeHoy(false),
    enabled: detalleComidas,
  });
  const abrirPersonalizar = (o: EsperadoHoy) => {
    setEditando(o);
    setTexto('');
  };

  // Botones personalizados por objetivo, guardados en el teléfono (AsyncStorage).
  const [pasosCustom, setPasosCustom] = useState<Record<string, number[]>>({});
  useEffect(() => {
    AsyncStorage.getItem('pasos_custom_v1').then((v) => {
      if (v) {
        try {
          setPasosCustom(JSON.parse(v));
        } catch {
          /* ignorar */
        }
      }
    });
  }, []);
  const persistirPasos = (next: Record<string, number[]>) => {
    setPasosCustom(next);
    AsyncStorage.setItem('pasos_custom_v1', JSON.stringify(next)).catch(() => {});
  };
  const agregarPaso = (id: string, v: number) => {
    const actuales = pasosCustom[id] ?? [];
    if (actuales.includes(v)) return;
    persistirPasos({ ...pasosCustom, [id]: [...actuales, v].sort((a, b) => a - b) });
  };
  const quitarPaso = (id: string, v: number) => {
    persistirPasos({ ...pasosCustom, [id]: (pasosCustom[id] ?? []).filter((x) => x !== v) });
  };

  // Marcar/sumar/omitir un objetivo cambia el historial → refrescar Hoy Y Progreso
  // (que queda montado en la otra pestaña con su caché). WEEKLY_COUNT y tareas no
  // entran en las stats de Progreso, así que esos no invalidan estas keys.
  const refrescarHoyYProgreso = () => {
    queryClient.invalidateQueries({ queryKey: ['esperados-hoy'] });
    queryClient.invalidateQueries({ queryKey: ['progreso-dias'] });
    queryClient.invalidateQueries({ queryKey: ['progreso-objetivos'] });
    queryClient.invalidateQueries({ queryKey: ['progreso-mes'] });
    queryClient.invalidateQueries({ queryKey: ['detalle-dia'] });
    queryClient.invalidateQueries({ queryKey: ['perfil-stats'] }); // XP/monedas de la barra
    queryClient.invalidateQueries({ queryKey: ['coleccion'] });
  };

  const marcar = useMutation({
    mutationFn: ({ id, completado }: { id: string; completado: boolean }) =>
      marcarObjetivoCompletado(id, hoy, completado),
    onSuccess: (_r, v) => {
      refrescarHoyYProgreso();
      if (v.completado) revisarLogros();
    },
  });
  const registrar = useMutation({
    mutationFn: ({ id, valor, meta }: { id: string; valor: number; meta: number | null }) =>
      registrarValorNumerico(id, hoy, valor, meta),
    onSuccess: () => {
      refrescarHoyYProgreso();
      revisarLogros();
    },
  });
  const omitir = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: boolean }) => omitirObjetivo(id, hoy, valor),
    onSuccess: refrescarHoyYProgreso,
  });

  // Health Connect: traer los datos de hoy (pasos/calorías). interactivo=true dispara el permiso.
  const sincronizarHC = useMutation({
    mutationFn: (interactivo: boolean) => sincronizarHealthConnect(interactivo),
    onSuccess: (res) => {
      if (res.ok) return refrescarHoyYProgreso();
      if (res.motivo === 'sin-permiso')
        Alert.alert('Permiso necesario', 'Permití el acceso en Health Connect para traer tus datos.');
      else if (res.motivo === 'no-disponible')
        Alert.alert(
          'Health Connect no disponible',
          'Instalá o activá Health Connect en tu teléfono (y una app que registre esos datos) para traerlos solos.',
        );
      else if (res.motivo === 'error')
        Alert.alert('No se pudo sincronizar', 'Hubo un problema leyendo los datos de Health Connect.');
    },
  });

  // Al abrir Hoy: si ya hay permiso, traer los datos en silencio (sin diálogo).
  useEffect(() => {
    if ((hcObjetivos?.length ?? 0) === 0) return;
    sincronizarHealthConnect(false)
      .then((res) => {
        if (res.ok) refrescarHoyYProgreso();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcObjetivos?.length]);

  const guardarPaso = () => {
    if (!editando) return;
    const n = Number(texto.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) agregarPaso(editando.id_objetivo, n);
    setEditando(null);
    setTexto('');
  };
  const marcarSemanal = useMutation({
    mutationFn: ({ id, completado }: { id: string; completado: boolean }) =>
      marcarObjetivoCompletado(id, hoy, completado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semanales-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
      queryClient.invalidateQueries({ queryKey: ['coleccion'] });
    },
  });
  const completar = useMutation({
    mutationFn: ({
      id,
      completada,
      prioridad,
    }: {
      id: string;
      completada: boolean;
      prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
    }) => completarTarea(id, completada, prioridad),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
      queryClient.invalidateQueries({ queryKey: ['coleccion'] });
      if (v.completada) revisarLogros();
    },
  });

  const nadaHoy =
    !isLoading &&
    !isError &&
    booleanos.length === 0 &&
    numericos.length === 0 &&
    (semanales?.length ?? 0) === 0 &&
    tareasHoy.length === 0 &&
    tareasProximas.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topbar}>
        <View style={styles.topLeft}>
          <DragonButton />
          <StatsPills />
        </View>
        <ProfileButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Recuadro principal */}
        <Card style={styles.hero}>
          <Text style={[styles.h1, styles.heroText]}>Hola, {nombre} 👋</Text>
          <Text style={[styles.muted, styles.heroText]}>{mensaje}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingRight: 92 }}>
            <View style={{ flex: 1 }}>
              <ProgressBar progress={percent / 100} color={colors.purple} />
            </View>
            <Text style={styles.percentLabel}>{percent}%</Text>
          </View>
          <DragonHero estado={estado} assetKey={assetKeyDragon} style={styles.heroDragon} />
        </Card>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}

        {isError && (
          <View style={{ marginTop: spacing.lg }}>
            <EstadoMensaje
              titulo="No pudimos cargar tu día"
              subtitulo="Revisá tu conexión e intentá de nuevo."
              onReintentar={() => refetch()}
            />
          </View>
        )}

        {nadaHoy && (
          <View style={{ marginTop: spacing.lg }}>
            <EstadoMensaje
              conDragon
              titulo="No tenés nada para hoy 🎉"
              subtitulo="Creá objetivos y tareas en la pestaña Objetivos y aparecerán acá."
            />
          </View>
        )}

        {/* Tareas de hoy (arriba, y no desaparecen al marcarlas: se ven hechas todo el día) */}
        {tareasHoy.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <SectionHeader icon="alarm-outline" iconColor={colors.orange} title="Tareas de hoy" subtitle="Para hacer hoy" />
              <Pressable onPress={() => router.push('/objetivos')} hitSlop={8}>
                <Text style={styles.verTodas}>Ver todas</Text>
              </Pressable>
            </View>
            <View style={{ gap: 10 }}>
              {tareasHoy.map((t) => {
                const vencida = !!t.fecha_limite && t.fecha_limite < hoy;
                return (
                  <Card key={t.id_tarea} style={styles.listRow}>
                    <Pressable
                      hitSlop={6}
                      onPress={() =>
                        completar.mutate({ id: t.id_tarea, completada: !t.completada, prioridad: t.prioridad })
                      }>
                      <View style={[styles.checkbox, t.completada && styles.checkboxDonePurple]}>
                        {t.completada && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLabel, t.completada && styles.goalTitleDone]}>{t.titulo}</Text>
                    </View>
                    <View style={[styles.chip, vencida ? styles.chipVencida : styles.chipHoy]}>
                      <Text style={styles.chipText}>{vencida ? 'Vencida' : 'Hoy'}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          </>
        )}

        {/* Hoy — objetivos booleanos */}
        {booleanos.length > 0 && (
          <>
            <SectionHeader icon="calendar-outline" title="Hoy" subtitle="Tus objetivos del día" />
            <Card>
              {booleanos.map((o, i) => (
                <Pressable
                  key={o.id_objetivo}
                  onPress={() => marcar.mutate({ id: o.id_objetivo, completado: !o.completado })}
                  style={[styles.checkline, i === booleanos.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.checkbox, o.completado && styles.checkboxDonePurple]}>
                    {o.completado && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.goalTitle, o.completado && styles.goalTitleDone]}>
                    {o.nombre}
                  </Text>
                  {o.hora_recordatorio && (
                    <Text style={styles.time}>{o.hora_recordatorio.slice(0, 5)}</Text>
                  )}
                  {o.completado ? (
                    <View style={styles.doneCircle}>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  )}
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {/* Recordá — objetivos numéricos */}
        {numericos.length > 0 && (
          <>
            <SectionHeader
              icon="water-outline"
              iconColor={colors.blue}
              title="Recordá"
              subtitle="Pequeños hábitos, grandes cambios"
            />
            <Card style={{ paddingVertical: 4 }}>
              {numericos.map((o, i) => {
                const cat = o.id_categoria ? catMap.get(o.id_categoria) : undefined;
                const ultimo = i === numericos.length - 1;
                const valor = o.valor ?? 0;
                const [pasoChico, pasoGrande] = pasosNumericos(o.meta_valor);
                const sumar = (paso: number) =>
                  registrar.mutate({ id: o.id_objetivo, valor: valor + paso, meta: o.meta_valor });

                // Objetivo autocompletado desde Health Connect: sin botones manuales.
                if (hcIds.has(o.id_objetivo)) {
                  const esCal = metricaDeUnidad(o.unidad) === 'CALORIES';
                  return (
                    <View
                      key={o.id_objetivo}
                      style={[styles.recordaRow, ultimo && { borderBottomWidth: 0 }]}>
                      <Text style={styles.recordaEmoji}>{cat?.icono ?? (esCal ? '🍎' : '👟')}</Text>
                      <View style={{ flex: 1, gap: 8 }}>
                        <View style={styles.rowBetween}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                            <Text style={styles.itemLabel}>{o.nombre}</Text>
                            {esCal && (
                              <Pressable onPress={() => setDetalleComidas(true)} hitSlop={10}>
                                <Ionicons name="information-circle-outline" size={17} color={colors.purple} />
                              </Pressable>
                            )}
                          </View>
                          <Text style={styles.muted}>
                            {fmt(valor)}/{o.meta_valor} {o.unidad ?? ''}
                          </Text>
                        </View>
                        <ProgressBar progress={creditoObjetivo(o)} color={colors.blue} />
                        <View style={styles.hcFooter}>
                          <Text style={styles.hcTag}>🔗 Health Connect</Text>
                          <Pressable
                            style={styles.stepBtnGhost}
                            onPress={() => sincronizarHC.mutate(true)}
                            disabled={sincronizarHC.isPending}>
                            {sincronizarHC.isPending ? (
                              <ActivityIndicator size="small" color={colors.purple} />
                            ) : (
                              <>
                                <Ionicons name="refresh" size={14} color={colors.purple} />
                                <Text style={styles.stepText}>Actualizar</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                }

                if (o.omitido) {
                  return (
                    <View
                      key={o.id_objetivo}
                      style={[styles.recordaRow, ultimo && { borderBottomWidth: 0 }]}>
                      <Text style={[styles.recordaEmoji, { opacity: 0.4 }]}>{cat?.icono ?? '🎯'}</Text>
                      <Text style={[styles.itemLabel, { flex: 1, opacity: 0.5 }]}>
                        {o.nombre} · omitido hoy
                      </Text>
                      <Pressable
                        onPress={() => omitir.mutate({ id: o.id_objetivo, valor: false })}
                        hitSlop={8}>
                        <Text style={styles.link}>Deshacer</Text>
                      </Pressable>
                    </View>
                  );
                }

                return (
                  <View
                    key={o.id_objetivo}
                    style={[styles.recordaRow, ultimo && { borderBottomWidth: 0 }]}>
                    <Text style={styles.recordaEmoji}>{cat?.icono ?? '🎯'}</Text>
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemLabel}>{o.nombre}</Text>
                        <Text style={styles.muted}>
                          {fmt(valor)}/{o.meta_valor} {o.unidad ?? ''}
                        </Text>
                      </View>
                      <ProgressBar progress={creditoObjetivo(o)} color={colors.purple} />
                      <View style={styles.stepRow}>
                        <Pressable style={styles.stepBtnMinus} onPress={() => sumar(-pasoGrande)}>
                          <Text style={styles.stepTextMinus}>−{fmt(pasoGrande)}</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtnMinus} onPress={() => sumar(-pasoChico)}>
                          <Text style={styles.stepTextMinus}>−{fmt(pasoChico)}</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtn} onPress={() => sumar(pasoChico)}>
                          <Text style={styles.stepText}>+{fmt(pasoChico)}</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtn} onPress={() => sumar(pasoGrande)}>
                          <Text style={styles.stepText}>+{fmt(pasoGrande)}</Text>
                        </Pressable>
                        {(pasosCustom[o.id_objetivo] ?? []).map((v) => (
                          <Pressable
                            key={v}
                            style={styles.stepBtn}
                            onPress={() => sumar(v)}
                            onLongPress={() => quitarPaso(o.id_objetivo, v)}>
                            <Text style={styles.stepText}>+{fmt(v)}</Text>
                          </Pressable>
                        ))}
                        <Pressable style={styles.stepBtnGhost} onPress={() => abrirPersonalizar(o)}>
                          <Ionicons name="add" size={15} color={colors.purple} />
                          <Text style={styles.stepText}>Botón</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Esta semana — WEEKLY_COUNT (opcional, no penaliza el % del día) */}
        {(semanales?.length ?? 0) > 0 && (
          <>
            <SectionHeader icon="repeat-outline" title="Esta semana" subtitle="Sumá cuando puedas" />
            <Card style={{ gap: spacing.md }}>
              {semanales!.map((s) => {
                const meta = s.meta ?? 1;
                return (
                  <View key={s.id_objetivo} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemLabel}>{s.nombre}</Text>
                        <Text style={styles.muted}>
                          {s.hechos}/{meta}
                        </Text>
                      </View>
                      <ProgressBar progress={s.hechos / meta} color={colors.green} />
                    </View>
                    <Pressable
                      onPress={() =>
                        marcarSemanal.mutate({ id: s.id_objetivo, completado: !s.completado_hoy })
                      }
                      style={[styles.semanalBtn, s.completado_hoy && styles.semanalBtnOn]}>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={s.completado_hoy ? '#fff' : colors.green}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Tareas próximas (mañana en adelante, esta semana) */}
        {tareasProximas.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <SectionHeader icon="document-text-outline" title="Tareas próximas" subtitle="Para los próximos días" />
              <Pressable onPress={() => router.push('/objetivos')} hitSlop={8}>
                <Text style={styles.verTodas}>Ver todas</Text>
              </Pressable>
            </View>
            <View style={{ gap: 10 }}>
              {tareasProximas.map((t) => (
                <Card key={t.id_tarea} style={styles.listRow}>
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      completar.mutate({ id: t.id_tarea, completada: true, prioridad: t.prioridad })
                    }>
                    <View style={styles.checkbox} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{t.titulo}</Text>
                  </View>
                  <View style={[styles.chip, styles.chipManana]}>
                    <Text style={styles.chipText}>
                      {t.fecha_limite === manana
                        ? 'Mañana'
                        : `${t.fecha_limite?.slice(8, 10)}/${t.fecha_limite?.slice(5, 7)}`}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal: ingresar cantidad exacta de un objetivo numérico */}
      <Modal
        visible={editando != null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditando(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditando(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Nuevo botón · {editando?.nombre}</Text>
              <Text style={styles.muted}>
                Creá un botón para sumar de a esa cantidad
                {editando?.unidad ? ` (${editando.unidad})` : ''}.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={texto}
                onChangeText={setTexto}
                keyboardType="numeric"
                placeholder="Ej: 300"
                placeholderTextColor={colors.textMuted}
                autoFocus
                onSubmitEditing={guardarPaso}
                returnKeyType="done"
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={guardarPaso}>
                  <Text style={styles.modalBtnPrimaryText}>Crear botón</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => {
                    if (editando) omitir.mutate({ id: editando.id_objetivo, valor: true });
                    setEditando(null);
                  }}>
                  <Text style={styles.link}>Omitir hoy</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={detalleComidas}
        transparent
        animationType="fade"
        onRequestClose={() => setDetalleComidas(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetalleComidas(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>🍽️ Comidas de hoy</Text>
            {comidasFetching && !comidasRes ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.purple} />
            ) : comidasRes?.ok ? (
              comidasRes.comidas.length === 0 ? (
                <Text style={styles.muted}>Todavía no hay comidas registradas hoy.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.comidasBox}>
                  {comidasRes.comidas.map((c, i) => (
                    <View key={i} style={styles.comidaRow}>
                      <Text style={styles.comidaNombre} numberOfLines={1}>
                        {etiquetaComida(c.mealType)}
                        {c.nombre ? ` · ${c.nombre}` : ''}
                      </Text>
                      <Text style={styles.comidaKcal}>{c.kcal} kcal</Text>
                    </View>
                  ))}
                  <View style={[styles.comidaRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.comidaTotal}>Total</Text>
                    <Text style={styles.comidaTotal}>
                      {comidasRes.comidas.reduce((s, c) => s + c.kcal, 0)} kcal
                    </Text>
                  </View>
                </ScrollView>
              )
            ) : (
              <Text style={styles.muted}>
                {comidasRes?.motivo === 'sin-permiso'
                  ? 'Permití el acceso a la nutrición en Health Connect para ver tus comidas.'
                  : 'No se pudieron leer las comidas de Health Connect.'}
              </Text>
            )}
            <Pressable style={styles.cerrarBtn} onPress={() => setDetalleComidas(false)}>
              <Text style={styles.modalBtnPrimaryText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  subtitle: string;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={iconColor ?? colors.text} />
        <Text style={styles.h2}>{title}</Text>
      </View>
      <Text style={[styles.muted, { marginLeft: 26, marginBottom: 10, marginTop: 2 }]}>{subtitle}</Text>
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 8 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  // marginTop deja aire arriba para que la cabeza del dragón NO la recorte el borde del ScrollView.
  hero: { backgroundColor: colors.cardPurple, overflow: 'visible', marginTop: 34 },
  heroText: { paddingRight: 100 },
  // Cuerpo entero (2:3) que sobresale por arriba del recuadro.
  heroDragon: { position: 'absolute', right: -6, top: -46 },
  h1: { fontSize: 19, fontWeight: '800', color: colors.purple700, marginBottom: 2 },
  h2: { fontSize: 18, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  percentLabel: { fontSize: 12, fontWeight: '800', color: colors.purple700 },
  itemLabel: { fontSize: 13.5, color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  verTodas: { color: colors.purple, fontWeight: '800', fontSize: 13, marginBottom: 10 },
  checkline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDonePurple: { borderColor: colors.purple, backgroundColor: colors.purple },
  goalTitle: { flex: 1, fontSize: 14.5, color: colors.text },
  goalTitleDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  doneCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recordaEmoji: { fontSize: 24, width: 30, textAlign: 'center' },
  link: { color: colors.purple, fontWeight: '800', fontSize: 12.5 },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  stepBtn: {
    backgroundColor: colors.purple100,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  stepBtnMinus: {
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  stepTextMinus: { color: colors.text, fontWeight: '800', fontSize: 12.5 },
  stepBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.purple100,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stepText: { color: colors.purple, fontWeight: '800', fontSize: 12.5 },
  hcFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  hcTag: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  comidaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  comidaNombre: { flex: 1, fontSize: 14, color: colors.text },
  comidaKcal: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  comidaTotal: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  comidasBox: { backgroundColor: colors.cardPurple, borderRadius: radius.md, paddingHorizontal: 12 },
  cerrarBtn: {
    backgroundColor: colors.purple,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(36,31,56,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: colors.purple },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  modalBtnGhost: { backgroundColor: colors.purple100 },
  semanalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semanalBtnOn: { backgroundColor: colors.green },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  chipHoy: { backgroundColor: colors.purple100 },
  chipManana: { backgroundColor: colors.orangeChip },
  chipVencida: { backgroundColor: colors.redBorder },
  chipText: { fontSize: 11, fontWeight: '800', color: colors.text },
});
