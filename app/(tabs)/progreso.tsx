import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { InsightsCarrusel } from '@/components/InsightsCarrusel';
import { ProfileButton } from '@/components/ProfileButton';
import { StatsPills } from '@/components/StatsPills';
import { useTheme } from '@/components/theme-provider';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';
import { usePremium } from '@/hooks/usePremium';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SpeechBubble } from '@/components/ui/SpeechBubble';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  congeladasEnRango,
  contarCongeladores,
  detalleDia,
  listarCategorias,
  listarObjetivos,
  listarTareas,
  type Objetivo,
  progresoPorDia,
  progresoPorObjetivo,
  type RegistroObjetivo,
  registrosEnRango,
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
import { iconoObjetivo } from '@/logic/iconos';
import { tareaOculta } from '@/logic/tareas';
import {
  agruparPorCategoria,
  construirInsights,
  delta,
  mensajeProgreso,
  nivelIntensidad,
  rachaActual,
  resumenRango,
  semanaLD,
  tendenciaMensual,
  UMBRAL_RACHA,
} from '@/logic/progreso';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ALPHA = ['', '3A', '73', 'B0', '']; // intensidad del calendario por nivel (hex alpha)

export default function ProgresoScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const assetKeyDragon = useDragonEquipado();
  const { esPremium } = usePremium();
  const hoy = hoyISO();
  // Ventana de historial: premium = AÑO CALENDARIO (desde el 1 de enero); no-premium = últimos 3 meses.
  const inicioVentana = esPremium ? `${hoy.slice(0, 4)}-01-01` : sumarMesesISO(hoy, -3);
  const inicioSemana = inicioSemanaISO(hoy);
  const inicioSemanaAnterior = sumarDiasISO(inicioSemana, -7);
  const finSemana = sumarDiasISO(inicioSemana, 6);

  const [mes, setMes] = useState(() => primerDiaMesISO(hoy));
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // Qué hábitos mostrar como grilla anual (se recuerda en el teléfono).
  const [gridsSel, setGridsSel] = useState<string[]>([]);
  const [chipsAbierto, setChipsAbierto] = useState(false); // selector desplegable
  useEffect(() => {
    AsyncStorage.getItem('grillas_v1').then((v) => {
      if (v) {
        try {
          setGridsSel(JSON.parse(v));
        } catch {
          /* ignorar */
        }
      }
    });
  }, []);
  const toggleGrid = (id: string) => {
    setGridsSel((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem('grillas_v1', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // Historial mensual: sin Premium solo se ven los últimos 3 meses (sus datos se purgan a los 3
  // meses). Ir más atrás (4º mes) queda bloqueado con candado → paywall.
  const mesMinNoPremium = primerDiaMesISO(sumarMesesISO(hoy, -3));
  const mesAnterior = primerDiaMesISO(sumarMesesISO(mes, -1));
  const bloqueaMesAtras = !esPremium && mesAnterior < mesMinNoPremium;
  // No se puede navegar más allá del mes en curso (los meses futuros no tienen progreso).
  const puedeAvanzarMes = mes < primerDiaMesISO(hoy);
  const irMesAtras = () => {
    if (bloqueaMesAtras) {
      Alert.alert(
        'Historial Premium 👑',
        'Con el plan gratis ves los últimos 3 meses (tus datos se guardan 3 meses). Hacete Premium para ver todo tu historial.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ver Premium', onPress: () => router.push('/premium') },
        ],
      );
      return;
    }
    setMes(mesAnterior);
  };

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
  // Insights del carrusel: sobre TODO el período disponible (mes en Gratis, año en Premium),
  // no solo la semana. Sin bloqueo premium (todos ven insights, con la data que tengan).
  const { data: insightsDias } = useQuery({
    queryKey: ['insights-dias', inicioVentana, hoy],
    queryFn: () => progresoPorDia(inicioVentana, hoy),
  });
  const { data: insightsObjs } = useQuery({
    queryKey: ['insights-objs', inicioVentana, hoy],
    queryFn: () => progresoPorObjetivo(inicioVentana, hoy),
  });
  // Objetivos VIGENTES hoy (para que los insights no sigan destacando objetivos borrados o terminados
  // por fecha_fin — "tu mejor objetivo es X" cuando ya no lo hacés).
  const { data: objetivosVigentes } = useQuery({
    queryKey: ['objetivos-vigentes'],
    queryFn: () => listarObjetivos({ soloActivos: true }),
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
  // Días protegidos por congeladores (la racha los saltea) + congeladores disponibles.
  const { data: congeladas } = useQuery({
    queryKey: ['congeladas', inicioRacha, hoy],
    queryFn: () => congeladasEnRango(inicioRacha, hoy),
  });
  const { data: congeladores } = useQuery({ queryKey: ['congeladores'], queryFn: contarCongeladores });
  // Ventana larga (para la grilla anual, tendencia mensual y comparación por categoría).
  const { data: diasVentana } = useQuery({
    queryKey: ['progreso-ventana', inicioVentana, hoy],
    queryFn: () => progresoPorDia(inicioVentana, hoy),
  });
  // Grillas anuales POR HÁBITO: todos los registros del rango + la lista de objetivos.
  const { data: registrosVentana } = useQuery({
    queryKey: ['registros-ventana', inicioVentana, hoy],
    queryFn: () => registrosEnRango(inicioVentana, hoy),
    enabled: esPremium,
  });
  const { data: objetivosLista } = useQuery({
    queryKey: ['objetivos-lista'],
    queryFn: () => listarObjetivos({ soloActivos: true }),
    enabled: esPremium,
  });

  const catMap = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id_categoria, c])),
    [categorias],
  );

  const todos = dias14 ?? [];
  // Comparación JUSTA: esta semana hasta HOY vs. la semana pasada hasta el MISMO día de la semana
  // (antes comparaba la semana parcial contra la anterior COMPLETA → un lunes siempre daba "peor").
  const finComparableAnterior = sumarDiasISO(inicioSemanaAnterior, diaSemanaISO(hoy) - 1);
  const estaSemana = todos.filter((d) => d.fecha >= inicioSemana && d.fecha <= hoy);
  const semanaAnterior = todos.filter(
    (d) => d.fecha >= inicioSemanaAnterior && d.fecha <= finComparableAnterior,
  );
  const resumen = resumenRango(estaSemana);
  const dResumen = delta(resumen, resumenRango(semanaAnterior));
  const ld = semanaLD(todos, inicioSemana, hoy);
  const grupos = agruparPorCategoria(objetivos ?? []);
  const racha = rachaActual(diasRacha ?? [], hoy, undefined, new Set(congeladas ?? []));
  // Insights personalizados (contenido y orden según los datos del usuario; vacío si no hay datos).
  // Los insights POR OBJETIVO solo miran objetivos vigentes hoy (activos y sin fecha_fin pasada), así
  // no se sigue destacando algo que ya borraste o que terminó.
  const insights = useMemo(() => {
    const vigentes = new Set(
      (objetivosVigentes ?? [])
        .filter((o) => !o.fecha_fin || o.fecha_fin >= hoy)
        .map((o) => o.id_objetivo),
    );
    const objsVigentes = (insightsObjs ?? []).filter((o) => vigentes.has(o.id_objetivo));
    return construirInsights({ diasVentana: insightsDias ?? [], objsVentana: objsVigentes, racha });
  }, [insightsDias, insightsObjs, objetivosVigentes, hoy, racha]);
  // Tendencia mensual + comparación por categoría (sobre la ventana según el plan).
  const tendencia = useMemo(() => tendenciaMensual(diasVentana ?? []), [diasVentana]);
  // Grillas anuales POR HÁBITO: registros agrupados por objetivo + helper para armar las semanas.
  const regsPorObj = useMemo(() => {
    const m = new Map<string, RegistroObjetivo[]>();
    for (const r of registrosVentana ?? []) {
      const a = m.get(r.id_objetivo) ?? [];
      a.push(r);
      m.set(r.id_objetivo, a);
    }
    return m;
  }, [registrosVentana]);
  // Grilla = AÑO CALENDARIO en curso, organizada por MES: 12 filas (Ene→Dic) × 31 columnas (días).
  // Entra TODO el año en una pantalla, sin scroll horizontal. Cada cuadrito = un día real; los días
  // FUTUROS se ven vacíos (tenues) y los que no existen en el mes (ej. 30/31 de feb) quedan transparentes.
  const anioActual = hoy.slice(0, 4);
  const construirGrid = (nivelPorFecha: Map<string, number>) => {
    const meses: CeldaGrid[][] = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const diasDelMes = Number(ultimoDiaMesISO(`${anioActual}-${mm}-01`).slice(8, 10)); // 28..31
      const fila: CeldaGrid[] = [];
      for (let d = 1; d <= 31; d++) {
        if (d > diasDelMes) {
          fila.push(null); // día inexistente en el mes → transparente
          continue;
        }
        const f = `${anioActual}-${mm}-${String(d).padStart(2, '0')}`;
        fila.push({ fecha: f, nivel: nivelPorFecha.get(f) ?? 0, futuro: f > hoy });
      }
      meses.push(fila);
    }
    return meses;
  };
  const creditoReg = (o: Objetivo, r: RegistroObjetivo | undefined): number => {
    if (!r || r.omitido) return 0;
    if ((o.tipo === 'NUMERIC' || o.tipo === 'DURATION') && o.meta_valor && o.meta_valor > 0)
      return Math.min(1, (r.valor ?? 0) / o.meta_valor);
    return r.completado ? 1 : 0;
  };

  // Tareas (se cuentan aparte de los objetivos, 🔒).
  const listaTareas = tareas ?? [];
  const tareasCompletadasSemana = listaTareas.filter((t) => {
    const f = t.fecha_completada?.slice(0, 10);
    return f && f >= inicioSemana && f <= finSemana;
  }).length;
  // Pendientes = sin completar y que TODAVÍA se ven (no las auto-ocultas: vencidas hace +7 días
  // o eliminadas estando vencidas). Antes contaba también esas → mostraba de más.
  const tareasPendientes = listaTareas.filter((t) => !t.completada && !tareaOculta(t, hoy)).length;

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
                : `Cumplí ${UMBRAL_RACHA}% de un día para arrancar tu racha`}
            </Text>
            {(congeladores ?? 0) > 0 && (
              <View style={styles.congeladores}>
                <Text style={styles.congeladoresText}>🧊 {congeladores}</Text>
              </View>
            )}
          </View>
          {(congeladores ?? 0) > 0 && (
            <Text style={styles.congeladoresHint}>
              Congeladores: si te salteás un día, se usan solos y tu racha no se corta.
            </Text>
          )}
        </Card>

        {/* Carrusel de insights personalizados (solo aparece si hay datos suficientes).
            Gratis = 1 estadística + candado; Premium = todas, deslizables y en movimiento. */}
        {insights.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <InsightsCarrusel
              insights={insights}
              esPremium={esPremium}
              onUpgrade={() => router.push('/premium')}
            />
          </View>
        )}

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
        <SectionHeader icon="pricetags-outline" title="Por categoría · esta semana" />
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
            <Pressable hitSlop={8} onPress={irMesAtras}>
              <Ionicons
                name={bloqueaMesAtras ? 'lock-closed' : 'chevron-back'}
                size={16}
                color={bloqueaMesAtras ? colors.purple : colors.text}
              />
            </Pressable>
            <Text style={styles.calMonth}>
              {nombreMes(mes)} {mes.slice(0, 4)}
            </Text>
            <Pressable
              hitSlop={8}
              disabled={!puedeAvanzarMes}
              onPress={() => puedeAvanzarMes && setMes(sumarMesesISO(mes, 1))}>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={puedeAvanzarMes ? colors.text : colors.textMuted}
                style={!puedeAvanzarMes && { opacity: 0.35 }}
              />
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

        {/* Tendencia mensual (ventana según el plan: 3 meses free / 12 premium) */}
        <SectionHeader icon="trending-up-outline" title="Tendencia mensual" />
        <Card>
          {tendencia.length === 0 ? (
            <Text style={styles.muted}>Todavía no hay suficientes datos.</Text>
          ) : (
            <View style={styles.tendRow}>
              {tendencia.map((m) => (
                <View key={m.mesISO} style={styles.tendCol}>
                  <Text style={styles.tendPct}>{m.esperados > 0 ? m.pct : '·'}</Text>
                  <View style={styles.tendBarWrap}>
                    <View
                      style={[styles.tendBar, { height: `${m.esperados > 0 ? Math.max(3, m.pct) : 0}%` }]}
                    />
                  </View>
                  <Text style={styles.tendMes}>{nombreMes(m.mesISO).slice(0, 3)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Grillas anuales por hábito (Premium) */}
        <SectionHeader icon="grid-outline" title="Grillas anuales" />
        {esPremium ? (
          <>
            <Card style={{ gap: 8 }}>
              <Pressable style={styles.chipsHeader} onPress={() => setChipsAbierto((v) => !v)}>
                <Text style={styles.itemTitle}>
                  Elegí qué hábitos ver{gridsSel.length > 0 ? ` (${gridsSel.length})` : ''}
                </Text>
                <Ionicons name={chipsAbierto ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>
              {chipsAbierto &&
                ((objetivosLista ?? []).length === 0 ? (
                  <Text style={styles.muted}>Todavía no tenés objetivos.</Text>
                ) : (
                  <View style={styles.chipsWrap}>
                    {(objetivosLista ?? []).map((o) => {
                      const sel = gridsSel.includes(o.id_objetivo);
                      return (
                        <Pressable
                          key={o.id_objetivo}
                          onPress={() => toggleGrid(o.id_objetivo)}
                          style={[styles.chip, sel && styles.chipSel]}>
                          <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                            {iconoObjetivo(o, catMap.get(o.id_categoria ?? '')?.icono)} {o.nombre}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
            </Card>

            {gridsSel.map((id) => {
              const o = (objetivosLista ?? []).find((x) => x.id_objetivo === id);
              if (!o) return null;
              const nivelPorFecha = new Map(
                (regsPorObj.get(id) ?? []).map((r) => [r.fecha, nivelIntensidad(creditoReg(o, r) * 100)] as const),
              );
              return (
                <Card key={id} style={{ gap: 8, marginTop: spacing.md }}>
                  <Text style={styles.itemTitle}>
                    {iconoObjetivo(o, catMap.get(o.id_categoria ?? '')?.icono)} {o.nombre}
                  </Text>
                  <GridDePuntos meses={construirGrid(nivelPorFecha)} colors={colors} />
                </Card>
              );
            })}
          </>
        ) : (
          <Pressable style={styles.premCard} onPress={() => router.push('/premium')}>
            <Ionicons name="lock-closed" size={20} color={colors.purple} />
            <Text style={styles.premText}>
              Las grillas anuales por hábito y el historial completo del año son Premium 👑.
            </Text>
            <Text style={styles.premCta}>Ver Premium</Text>
          </Pressable>
        )}
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, o.omitido && { opacity: 0.5 }]}>{o.nombre}</Text>
                    {o.omitido && o.razon_omision ? (
                      <Text style={styles.razonOmision} numberOfLines={2}>
                        “{o.razon_omision}”
                      </Text>
                    ) : null}
                  </View>
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

const GAP_GRID = 2;

/** Celda de la grilla anual: un día real (con su nivel), o `null` (día inexistente → transparente). */
type CeldaGrid = { fecha: string; nivel: number; futuro: boolean } | null;

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Grilla anual por MES: 12 filas (una por mes) × 31 columnas (días). Los cuadraditos se auto-ajustan
 * al ancho de la tarjeta → entra TODO el año en una pantalla, sin scroll horizontal.
 */
// Colores del arcoíris para la grilla del tema Arcoíris: cada MES toma un color y la
// intensidad del día se representa con el alpha (más lleno = más cumplido).
const ARCOIRIS_GRID = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];

function GridDePuntos({ meses, colors }: { meses: CeldaGrid[][]; colors: Tema }) {
  // En el tema Arcoíris cada mes es de un color; el resto usa el verde de siempre.
  const colorCelda = (c: CeldaGrid, m: number): string => {
    if (c == null) return 'transparent';
    if (c.futuro) return colors.track + '55'; // día futuro → vacío tenue
    if (c.nivel === 0) return colors.track;
    const base = colors.arcoiris ? ARCOIRIS_GRID[m % ARCOIRIS_GRID.length] : colors.green;
    return c.nivel === 4 ? base : base + ALPHA[c.nivel];
  };
  return (
    <View style={{ gap: GAP_GRID }}>
      {meses.map((fila, m) => (
        <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: GAP_GRID }}>
          <Text style={{ width: 26, fontSize: 10, fontWeight: '700', color: colors.textMuted }}>
            {MESES_CORTOS[m]}
          </Text>
          <View style={{ flex: 1, flexDirection: 'row', gap: GAP_GRID }}>
            {fila.map((c, d) => (
              <View
                key={d}
                style={{ flex: 1, aspectRatio: 1, borderRadius: 2, backgroundColor: colorCelda(c, m) }}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
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
  razonOmision: { fontSize: 11.5, color: colors.textMuted, fontStyle: 'italic', marginTop: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.purple, fontWeight: '800', fontSize: 13 },

  bigPct: { fontSize: 34, fontWeight: '800', color: colors.purple700 },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill },
  deltaUp: { backgroundColor: colors.green100 },
  deltaDown: { backgroundColor: colors.redBorder },
  deltaText: { fontSize: 11, fontWeight: '800' },
  rachaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 },
  rachaText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  congeladores: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  congeladoresText: { fontSize: 12.5, fontWeight: '800', color: colors.text },
  congeladoresHint: { fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
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
  // Tendencia mensual
  tendRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 6 },
  tendCol: { flex: 1, alignItems: 'center', gap: 4 },
  tendPct: { fontSize: 10.5, fontWeight: '800', color: colors.textMuted },
  tendBarWrap: { width: 20, height: 90, backgroundColor: colors.track, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  tendBar: { width: '100%', backgroundColor: colors.purple, borderRadius: 6 },
  tendMes: { fontSize: 10.5, color: colors.textMuted, textTransform: 'capitalize' },
  // Grilla anual
  grid: { flexDirection: 'row', gap: 3 },
  gridCol: { gap: 3 },
  gridCell: { width: 11, height: 11, borderRadius: 2.5 },
  chipsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipSel: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { fontSize: 12.5, color: colors.text, fontWeight: '600' },
  chipTextSel: { color: '#fff' },
  premCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: 16,
  },
  premText: { fontSize: 13, color: colors.text, textAlign: 'center', lineHeight: 18 },
  premCta: { fontSize: 13.5, fontWeight: '800', color: colors.purple, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(36,31,56,0.4)', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  detRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalClose: { alignSelf: 'flex-end', marginTop: 4 },
});
