import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonButton } from '@/components/DragonButton';
import { DragonMascot } from '@/components/DragonMascot';
import { ProfileButton } from '@/components/ProfileButton';
import { StatsPills } from '@/components/StatsPills';
import { useTheme } from '@/components/theme-provider';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SpeechBubble } from '@/components/ui/SpeechBubble';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  detalleDia,
  listarCategorias,
  listarTareas,
  progresoPorDia,
  progresoPorObjetivo,
} from '@/lib/data';
import {
  diaSemanaISO,
  hoyISO,
  inicioSemanaISO,
  nombreMes,
  primerDiaMesISO,
  sumarDiasISO,
  sumarMesesISO,
  ultimoDiaMesISO,
} from '@/logic/fecha';
import {
  agruparPorCategoria,
  delta,
  mensajeProgreso,
  nivelIntensidad,
  rachaActual,
  resumenRango,
  semanaLD,
} from '@/logic/progreso';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ALPHA = ['', '3A', '73', 'B0', '']; // intensidad del calendario por nivel (hex alpha)

export default function ProgresoScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const assetKeyDragon = useDragonEquipado();
  const hoy = hoyISO();
  const inicioSemana = inicioSemanaISO(hoy);
  const inicioSemanaAnterior = sumarDiasISO(inicioSemana, -7);
  const finSemana = sumarDiasISO(inicioSemana, 6);

  const [mes, setMes] = useState(() => primerDiaMesISO(hoy));
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  // 14 días (semana actual + anterior) → resumen, delta y barras L→D.
  const {
    data: dias14,
    isLoading: cargandoSemana,
    isError: errorSemana,
    refetch: refetchSemana,
  } = useQuery({
    queryKey: ['progreso-dias', inicioSemanaAnterior, finSemana],
    queryFn: () => progresoPorDia(inicioSemanaAnterior, finSemana),
  });
  const { data: objetivos } = useQuery({
    queryKey: ['progreso-objetivos', inicioSemana, finSemana],
    queryFn: () => progresoPorObjetivo(inicioSemana, finSemana),
  });
  const { data: diasMes } = useQuery({
    queryKey: ['progreso-mes', mes],
    queryFn: () => progresoPorDia(primerDiaMesISO(mes), ultimoDiaMesISO(mes)),
  });
  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  const { data: detalle } = useQuery({
    queryKey: ['detalle-dia', diaDetalle],
    queryFn: () => detalleDia(diaDetalle!),
    enabled: diaDetalle != null,
  });
  // Últimos 45 días para la racha (métrica secundaria).
  const inicioRacha = sumarDiasISO(hoy, -45);
  const { data: diasRacha } = useQuery({
    queryKey: ['progreso-racha', inicioRacha, hoy],
    queryFn: () => progresoPorDia(inicioRacha, hoy),
  });
  const { data: tareas } = useQuery({ queryKey: ['tareas'], queryFn: () => listarTareas() });

  const catMap = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id_categoria, c])),
    [categorias],
  );

  const todos = dias14 ?? [];
  const estaSemana = todos.filter((d) => d.fecha >= inicioSemana);
  const semanaAnterior = todos.filter((d) => d.fecha < inicioSemana);
  const resumen = resumenRango(estaSemana);
  const dResumen = delta(resumen, resumenRango(semanaAnterior));
  const ld = semanaLD(todos, inicioSemana, hoy);
  const grupos = agruparPorCategoria(objetivos ?? []);
  const racha = rachaActual(diasRacha ?? [], hoy);

  // Tareas (se cuentan aparte de los objetivos, 🔒).
  const listaTareas = tareas ?? [];
  const tareasCompletadasSemana = listaTareas.filter((t) => {
    const f = t.fecha_completada?.slice(0, 10);
    return f && f >= inicioSemana && f <= finSemana;
  }).length;
  const tareasPendientes = listaTareas.filter((t) => !t.completada).length;

  // Celdas del calendario del mes visible.
  const celdas = useMemo(() => {
    const porFecha = new Map((diasMes ?? []).map((d) => [d.fecha, d]));
    const primero = primerDiaMesISO(mes);
    const totalDias = Number(ultimoDiaMesISO(mes).slice(8, 10));
    const lista: ({ fecha: string; pct: number | null } | null)[] = [];
    for (let i = 0; i < diaSemanaISO(primero) - 1; i++) lista.push(null); // huecos iniciales
    for (let d = 1; d <= totalDias; d++) {
      const fecha = `${mes.slice(0, 7)}-${String(d).padStart(2, '0')}`;
      const row = porFecha.get(fecha);
      lista.push({ fecha, pct: row && row.esperados > 0 ? row.pct : null });
    }
    while (lista.length % 7 !== 0) lista.push(null);
    return lista;
  }, [diasMes, mes]);

  const toggleCat = (key: string) =>
    setExpandidas((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

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
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="stats-chart-outline" size={22} color={colors.purple} />
            <Text style={styles.h1}>Progreso</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <SpeechBubble maxWidth={118} tail="right">{mensajeProgreso(resumen.pct)}</SpeechBubble>
            <DragonMascot assetKey={assetKeyDragon} size={84} />
          </View>
        </View>

        {errorSemana && (
          <View style={{ marginTop: spacing.lg }}>
            <EstadoMensaje
              titulo="No pudimos cargar tu progreso"
              subtitulo="Revisá tu conexión e intentá de nuevo."
              onReintentar={() => refetchSemana()}
            />
          </View>
        )}

        {/* Resumen semanal — consistencia (métrica principal) + delta vs semana anterior */}
        <SectionHeader icon="flame-outline" title="Esta semana" />
        <Card style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.bigPct}>{resumen.pct}%</Text>
            {resumen.esperados > 0 && (
              <View style={[styles.deltaChip, dResumen >= 0 ? styles.deltaUp : styles.deltaDown]}>
                <Ionicons
                  name={dResumen >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={dResumen >= 0 ? colors.green700 : colors.red}
                />
                <Text style={[styles.deltaText, { color: dResumen >= 0 ? colors.green700 : colors.red }]}>
                  {Math.abs(dResumen)}% vs. semana anterior
                </Text>
              </View>
            )}
          </View>
          <ProgressBar progress={resumen.pct / 100} color={colors.purple} />
          <Text style={styles.muted}>
            {resumen.esperados > 0
              ? 'Consistencia: cuánto de lo planificado cumpliste esta semana.'
              : 'No tenías objetivos planificados esta semana.'}
          </Text>
          <View style={styles.rachaRow}>
            <Ionicons name="flame" size={16} color={racha > 0 ? colors.orange : colors.textMuted} />
            <Text style={styles.rachaText}>
              {racha > 0
                ? `Racha: ${racha} ${racha === 1 ? 'día' : 'días'} seguidos`
                : 'Completá un día entero para arrancar tu racha'}
            </Text>
          </View>
        </Card>

        {/* Tareas — se cuentan aparte de los objetivos (🔒) */}
        <SectionHeader icon="checkbox-outline" title="Tareas" />
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.tareaStat}>
            <Text style={styles.tareaNum}>{tareasCompletadasSemana}</Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>completadas esta semana</Text>
          </View>
          <View style={styles.tareaDivider} />
          <View style={styles.tareaStat}>
            <Text style={styles.tareaNum}>{tareasPendientes}</Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>pendientes</Text>
          </View>
        </Card>

        {/* Progreso por día (L→D) */}
        <SectionHeader icon="today-outline" title="Por día" />
        <Card>
          <View style={styles.ldRow}>
            {ld.map((c, i) => {
              const alto = c.pct == null ? 0 : Math.max(6, (c.pct / 100) * 64);
              const esHoy = c.fecha === hoy;
              return (
                <View key={i} style={styles.ldCol}>
                  <View style={styles.ldTrack}>
                    {c.pct != null && (
                      <View style={[styles.ldFill, { height: alto, backgroundColor: colors.purple }]} />
                    )}
                  </View>
                  <Text style={[styles.ldLabel, esHoy && styles.ldLabelHoy]}>{c.label}</Text>
                  <Text style={styles.ldPct}>{c.pct == null ? '·' : `${c.pct}%`}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Por categoría (tocar → desglose por objetivo) */}
        <SectionHeader icon="pricetags-outline" title="Por categoría" />
        {cargandoSemana && <ActivityIndicator style={{ marginVertical: 12 }} />}
        {!cargandoSemana && grupos.length === 0 && (
          <Card>
            <Text style={styles.muted}>Todavía no hay objetivos para medir esta semana.</Text>
          </Card>
        )}
        {grupos.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            {grupos.map((g) => {
              const key = g.id_categoria ?? '__sin__';
              const cat = g.id_categoria ? catMap.get(g.id_categoria) : undefined;
              const color = cat?.color ?? colors.purple;
              const abierta = expandidas.has(key);
              return (
                <View key={key}>
                  <Pressable style={styles.catRow} onPress={() => toggleCat(key)}>
                    <View style={[styles.catIcon, { backgroundColor: color + '22' }]}>
                      <Text style={{ fontSize: 16 }}>{cat?.icono ?? '🎯'}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemTitle}>{cat?.nombre ?? 'Sin categoría'}</Text>
                        <Text style={styles.muted}>{g.pct}%</Text>
                      </View>
                      <ProgressBar progress={g.pct / 100} color={color} />
                    </View>
                    <Ionicons
                      name={abierta ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {abierta &&
                    g.objetivos.map((o) => (
                      <View key={o.id_objetivo} style={styles.subRow}>
                        <Text style={[styles.muted, { flex: 1 }]}>{o.nombre}</Text>
                        <View style={{ width: 90 }}>
                          <ProgressBar progress={o.pct / 100} color={color} />
                        </View>
                        <Text style={[styles.muted, { width: 34, textAlign: 'right' }]}>{o.pct}%</Text>
                      </View>
                    ))}
                </View>
              );
            })}
          </Card>
        )}

        {/* Mes — calendario con intensidad; tocar un día → detalle */}
        <SectionHeader icon="calendar-outline" title="Mes" />
        <Card>
          <View style={styles.calHeader}>
            <Pressable hitSlop={8} onPress={() => setMes(sumarMesesISO(mes, -1))}>
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </Pressable>
            <Text style={styles.calMonth}>
              {nombreMes(mes)} {mes.slice(0, 4)}
            </Text>
            <Pressable hitSlop={8} onPress={() => setMes(sumarMesesISO(mes, 1))}>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.calGrid}>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={styles.calDayLabel}>
                {d}
              </Text>
            ))}
            {celdas.map((c, i) => {
              if (!c) return <View key={i} style={styles.calCellEmpty} />;
              const nivel = nivelIntensidad(c.pct);
              const bg =
                nivel === 0 ? colors.track : nivel === 4 ? colors.green : colors.green + ALPHA[nivel];
              const esHoy = c.fecha === hoy;
              const futuro = c.fecha > hoy;
              const dia = Number(c.fecha.slice(8, 10));
              return (
                <Pressable
                  key={i}
                  disabled={futuro}
                  onPress={() => setDiaDetalle(c.fecha)}
                  style={[styles.calCell, { backgroundColor: bg }, esHoy && styles.calCellHoy]}>
                  <Text style={[styles.calCellText, nivel >= 3 && { color: '#fff' }, futuro && { opacity: 0.35 }]}>
                    {dia}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.leyenda}>
            <Text style={styles.muted}>Menos</Text>
            {[0, 1, 2, 3, 4].map((n) => (
              <View
                key={n}
                style={[
                  styles.leyendaCell,
                  { backgroundColor: n === 0 ? colors.track : n === 4 ? colors.green : colors.green + ALPHA[n] },
                ]}
              />
            ))}
            <Text style={styles.muted}>Más</Text>
          </View>
        </Card>
      </ScrollView>

      {/* Detalle de un día del calendario */}
      <Modal
        visible={diaDetalle != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDiaDetalle(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDiaDetalle(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{diaDetalle && fechaLarga(diaDetalle)}</Text>
            {(detalle ?? []).length === 0 ? (
              <Text style={styles.muted}>No había objetivos planificados ese día.</Text>
            ) : (
              (detalle ?? []).map((o) => (
                <View key={o.id_objetivo} style={styles.detRow}>
                  <View
                    style={[
                      styles.detDot,
                      o.omitido
                        ? { backgroundColor: colors.track }
                        : o.credito >= 1
                          ? { backgroundColor: colors.green }
                          : o.credito > 0
                            ? { backgroundColor: colors.purple }
                            : { borderWidth: 2, borderColor: colors.divider },
                    ]}>
                    {!o.omitido && o.credito >= 1 && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                  <Text style={[styles.itemTitle, { flex: 1 }, o.omitido && { opacity: 0.5 }]}>
                    {o.nombre}
                  </Text>
                  <Text style={styles.muted}>
                    {o.omitido
                      ? 'omitido'
                      : o.tipo === 'NUMERIC'
                        ? `${o.valor ?? 0}/${o.meta_valor} ${o.unidad ?? ''}`
                        : o.credito >= 1
                          ? 'hecho'
                          : 'no'}
                  </Text>
                </View>
              ))
            )}
            <Pressable style={styles.modalClose} onPress={() => setDiaDetalle(null)}>
              <Text style={styles.link}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** '2026-08-11' → '11 de agosto'. */
function fechaLarga(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${nombreMes(iso).toLowerCase()}`;
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      }}>
      <Ionicons name={icon} size={18} color={colors.purple} />
      <Text style={styles.h2}>{title}</Text>
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 8 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  itemTitle: { fontSize: 13.5, color: colors.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.purple, fontWeight: '800', fontSize: 13 },

  bigPct: { fontSize: 34, fontWeight: '800', color: colors.purple700 },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill },
  deltaUp: { backgroundColor: colors.green100 },
  deltaDown: { backgroundColor: colors.redBorder },
  deltaText: { fontSize: 11, fontWeight: '800' },
  rachaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 },
  rachaText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  tareaStat: { flex: 1, alignItems: 'center', gap: 2 },
  tareaNum: { fontSize: 26, fontWeight: '800', color: colors.purple700 },
  tareaDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.divider },

  ldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ldCol: { alignItems: 'center', gap: 5, flex: 1 },
  ldTrack: { width: 12, height: 64, borderRadius: radius.pill, backgroundColor: colors.track, justifyContent: 'flex-end', overflow: 'hidden' },
  ldFill: { width: 12, borderRadius: radius.pill },
  ldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  ldLabelHoy: { color: colors.purple },
  ldPct: { fontSize: 10, color: colors.textMuted },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 46, paddingTop: 8 },

  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  calMonth: { fontSize: 14, fontWeight: '800', color: colors.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, color: colors.textMuted, marginBottom: 6 },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    marginBottom: 4,
  },
  calCellEmpty: { width: `${100 / 7}%`, aspectRatio: 1, marginBottom: 4 },
  calCellHoy: { borderWidth: 2, borderColor: colors.purple },
  calCellText: { fontSize: 10.5, color: colors.text, fontWeight: '600' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' },
  leyendaCell: { width: 14, height: 14, borderRadius: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(36,31,56,0.4)', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  detRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalClose: { alignSelf: 'flex-end', marginTop: 4 },
});
