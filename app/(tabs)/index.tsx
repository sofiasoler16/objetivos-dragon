import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { useCronometroCtx } from '@/components/cronometro-provider';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';
import { usePremium } from '@/hooks/usePremium';
import { useRevisarCongeladores } from '@/hooks/useRevisarCongeladores';
import { useRevisarLogros } from '@/hooks/useRevisarLogros';
import { PremiumBadge } from '@/components/ui/PremiumBadge';
import { useSession } from '@/components/session-provider';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  comidasDeHoy,
  contarPendientes,
  esErrorDeRed,
  esperadosHoy,
  guardarMarcar,
  guardarNumerico,
  guardarOmitir,
  guardarSemanalDelta,
  guardarTarea,
  listarCategorias,
  listarTareas,
  marcarItemGrupo,
  metricaDeUnidad,
  misItemsHoyGrupos,
  objetivosHealthConnect,
  omitirYReflejar,
  semanalesHoy,
  sincronizarHealthConnect,
} from '@/lib/data';
import type { ItemHoyGrupo, SemanalHoy, Tarea } from '@/lib/data';
import { estadoDragon, mensajeDragon } from '@/logic/dragon';
import { fechaLargaConDia, hoyISO, horaActual, sumarDiasISO } from '@/logic/fecha';
import { iconoObjetivo } from '@/logic/iconos';
import { tareaOculta } from '@/logic/tareas';
import { guardarSnapshotWidget } from '@/lib/widget';
import {
  creditoObjetivo,
  esAcumulable,
  type EsperadoHoy,
  formatearMinutos,
  pasosDuracion,
  pasosNumericos,
  porcentajeDia,
} from '@/logic/hoy';

/** Formatea un número sin decimales sobrantes (250 → "250", 2.5 → "2,5"). */
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Segundos → "MM:SS" (o "H:MM:SS" si pasa la hora), para el cronómetro en vivo. */
const mmss = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(seg).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// MealType de Health Connect (0=desconocido, 1=desayuno, 2=almuerzo, 3=cena, 4=snack).
const etiquetaComida = (t: number) =>
  ({ 1: 'Desayuno', 2: 'Almuerzo', 3: 'Cena', 4: 'Snack' })[t] ?? 'Comida';

export default function HoyScreen() {
  const queryClient = useQueryClient();
  const revisarLogros = useRevisarLogros();
  const revisarCongeladores = useRevisarCongeladores();
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { session } = useSession();
  const assetKeyDragon = useDragonEquipado();
  const { esPremium } = usePremium();
  const email = session?.user.email ?? '';
  const nombre = (session?.user.user_metadata?.nombre as string) || email.split('@')[0] || 'crack';

  const hoy = hoyISO();
  const manana = sumarDiasISO(hoy, 1);
  // Día que se está viendo en Hoy (para marcar lo olvidado). Por defecto = hoy.
  const [fecha, setFecha] = useState(hoy);
  const esHoy = fecha === hoy;
  // Se puede retroceder hasta 7 días atrás (límite de UX, no técnico).
  const limiteAtras = sumarDiasISO(hoy, -7);
  const puedeAtras = fecha > limiteAtras;

  const {
    data: esperados,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['esperados-hoy', fecha],
    queryFn: () => esperadosHoy(undefined, esHoy ? undefined : fecha),
  });
  const { data: semanales } = useQuery({
    queryKey: ['semanales-hoy', fecha],
    queryFn: () => semanalesHoy(undefined, esHoy ? undefined : fecha),
  });
  const { data: tareas } = useQuery({ queryKey: ['tareas'], queryFn: () => listarTareas() });
  // Ítems de mis grupos que agregué a mi Hoy (adoptados). Suman al grupo, no a mi % personal.
  const { data: itemsGrupos } = useQuery({
    queryKey: ['items-hoy-grupos', fecha],
    queryFn: () => misItemsHoyGrupos(fecha),
  });
  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  // Cambios hechos sin internet que todavía no se subieron (para el aviso).
  const { data: pendientes = 0 } = useQuery({ queryKey: ['pendientes'], queryFn: contarPendientes });
  const catMap = new Map((categorias ?? []).map((c) => [c.id_categoria, c]));
  // Objetivos que se autocompletan desde Health Connect (para marcarlos en la UI).
  const { data: hcObjetivos } = useQuery({ queryKey: ['objetivos-hc'], queryFn: objetivosHealthConnect });
  const hcIds = new Set((hcObjetivos ?? []).map((o) => o.id_objetivo));

  // Refrescar Hoy cada vez que se entra a la pestaña (para reflejar objetivos/tareas recién
  // creados o editados desde otra pantalla, aunque la pestaña haya quedado montada).
  useFocusEffect(
    useCallback(() => {
      for (const k of [['esperados-hoy'], ['semanales-hoy'], ['tareas'], ['objetivos-hc']])
        queryClient.invalidateQueries({ queryKey: k });
    }, [queryClient]),
  );

  const lista = esperados ?? [];
  const booleanos = lista.filter((o) => o.tipo === 'BOOLEAN');
  const numericos = lista.filter((o) => esAcumulable(o.tipo)); // NUMERIC + DURATION
  // Las tareas que vencen el día que se está viendo suman al % (cada una = un ítem Sí/No).
  const tareasDelDia = (tareas ?? []).filter((t) => t.fecha_limite?.slice(0, 10) === fecha);
  const percent = porcentajeDia(lista, tareasDelDia);
  const estado = estadoDragon(percent, esHoy ? horaActual() : 12);
  const mensaje = mensajeDragon(estado);
  const finSemana = sumarDiasISO(hoy, 7);
  // Hoy: vencen hoy (marcadas o no, para que no desaparezcan) o vencidas sin completar.
  // Se ocultan las eliminadas y las vencidas hace más de 7 días.
  const tareasHoy = (tareas ?? []).filter(
    (t) =>
      !tareaOculta(t, hoy) &&
      t.fecha_limite &&
      (t.fecha_limite === hoy || (!t.completada && t.fecha_limite < hoy)),
  );
  // Próximas: de mañana hasta 7 días, sin completar.
  const tareasProximas = (tareas ?? []).filter(
    (t) =>
      !tareaOculta(t, hoy) &&
      !t.completada &&
      t.fecha_limite &&
      t.fecha_limite > hoy &&
      t.fecha_limite <= finSemana,
  );

  // Snapshot para el widget de Android: solo cuando se está viendo HOY. Guarda la lista de
  // objetivos + tareas del día (el widget la lee con la app cerrada). Firma para no reescribir
  // en cada render; el percent va guardado para un futuro widget de % (este no lo dibuja).
  const itemsWidget = esHoy
    ? [
        ...lista.map((o) => ({ nombre: o.nombre, hecho: !!o.completado })),
        ...tareasHoy.map((t) => ({ nombre: t.titulo, hecho: !!t.completada })),
      ]
    : [];
  const firmaWidget = esHoy
    ? `${Math.round(percent)}|${itemsWidget.map((i) => `${i.nombre}:${i.hecho}`).join(',')}`
    : '';
  useEffect(() => {
    if (!esHoy) return;
    guardarSnapshotWidget({ fecha: hoy, percent: Math.round(percent), items: itemsWidget });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaWidget, esHoy, hoy]);

  // Modal para crear un botón nuevo (valor personalizado) de un objetivo numérico.
  const [editando, setEditando] = useState<EsperadoHoy | null>(null);
  const [texto, setTexto] = useState('');

  // Modal con el detalle de comidas de hoy (Health Connect) del objetivo de calorías.
  const [detalleComidas, setDetalleComidas] = useState(false);
  const { data: comidasRes, isFetching: comidasFetching } = useQuery({
    queryKey: ['comidas-hoy', fecha],
    queryFn: () => comidasDeHoy(false, fecha),
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

  // Actualización optimista del cache de Hoy: el ✓ y el % cambian al instante (también offline).
  // Si el guardado falla por RED, el wrapper encola el cambio y NO lanza → la optimista se conserva.
  // Si es un error REAL, onError revierte con el snapshot previo.
  const parcharEsperado = (id: string, cambio: Partial<EsperadoHoy>) =>
    queryClient.setQueryData<EsperadoHoy[]>(['esperados-hoy', fecha], (old) =>
      (old ?? []).map((o) => (o.id_objetivo === id ? { ...o, ...cambio } : o)),
    );
  const invalidarPendientes = () => queryClient.invalidateQueries({ queryKey: ['pendientes'] });

  const marcar = useMutation({
    mutationFn: ({ id, completado }: { id: string; completado: boolean }) =>
      guardarMarcar(id, fecha, completado),
    onMutate: async ({ id, completado }) => {
      await queryClient.cancelQueries({ queryKey: ['esperados-hoy', fecha] });
      const prev = queryClient.getQueryData<EsperadoHoy[]>(['esperados-hoy', fecha]);
      parcharEsperado(id, { completado });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['esperados-hoy', fecha], ctx.prev);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo.');
    },
    onSuccess: (res, v) => {
      if (res === 'ok' && v.completado) revisarLogros();
    },
    onSettled: () => {
      refrescarHoyYProgreso();
      invalidarPendientes();
    },
  });
  const registrar = useMutation({
    mutationFn: ({ id, valor, meta }: { id: string; valor: number; meta: number | null }) =>
      guardarNumerico(id, fecha, valor, meta),
    onMutate: async ({ id, valor, meta }) => {
      await queryClient.cancelQueries({ queryKey: ['esperados-hoy', fecha] });
      const prev = queryClient.getQueryData<EsperadoHoy[]>(['esperados-hoy', fecha]);
      const completado = meta != null && meta > 0 && valor >= meta;
      parcharEsperado(id, { valor: Math.max(0, valor), completado });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['esperados-hoy', fecha], ctx.prev);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo.');
    },
    onSuccess: (res) => {
      if (res === 'ok') revisarLogros();
    },
    onSettled: () => {
      refrescarHoyYProgreso();
      invalidarPendientes();
    },
  });

  // Metas semanales acumuladas: sumar al valor de hoy sin marcar completado (la meta es semanal).
  const sumarSemanal = useMutation({
    mutationFn: ({ id, fecha: f, delta }: { id: string; fecha: string; delta: number }) =>
      guardarSemanalDelta(id, f, delta),
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: ['semanales-hoy', fecha] });
      const prev = queryClient.getQueryData<SemanalHoy[]>(['semanales-hoy', fecha]);
      queryClient.setQueryData<SemanalHoy[]>(['semanales-hoy', fecha], (old) =>
        (old ?? []).map((s) => (s.id_objetivo === id ? { ...s, hechos: Math.max(0, s.hechos + delta) } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['semanales-hoy', fecha], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['semanales-hoy'] });
      invalidarPendientes();
    },
  });
  // Cronómetro ÚNICO compartido (mismo timer que la pantalla de foco). El commit lo hace el provider.
  const { activo: crono, segundos: cronoSeg } = useCronometroCtx();
  const omitir = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      // Online refleja también al calendario; sin red, encolamos solo el registro de la base.
      try {
        await omitirYReflejar(id, fecha, valor);
        return 'ok' as const;
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        await guardarOmitir(id, fecha, valor);
        return 'encolado' as const;
      }
    },
    onMutate: async ({ id, valor }) => {
      await queryClient.cancelQueries({ queryKey: ['esperados-hoy', fecha] });
      const prev = queryClient.getQueryData<EsperadoHoy[]>(['esperados-hoy', fecha]);
      parcharEsperado(id, { omitido: valor });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['esperados-hoy', fecha], ctx.prev);
    },
    onSettled: () => {
      refrescarHoyYProgreso();
      for (const k of [['agenda-semana'], ['agenda-dia'], ['agenda-mes']]) // se refleja en Mi semana (todas las vistas)
        queryClient.invalidateQueries({ queryKey: k });
      invalidarPendientes();
    },
  });

  // Health Connect: traer los datos del día que se está viendo (pasos/calorías). interactivo=true
  // dispara el permiso. Botón "Actualizar": funciona en HOY y en días anteriores (HC guarda el
  // histórico) → sirve para completar un día que se pasó sin abrir la app.
  const sincronizarHC = useMutation({
    mutationFn: (interactivo: boolean) => sincronizarHealthConnect(interactivo, fecha),
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

  // Health Connect AUTOMÁTICO: además del botón, sincroniza en silencio. Solo en "hoy" y si
  // hay objetivos HC (HC lee el día actual del dispositivo).
  const autoSyncHC = useCallback(() => {
    if (!esHoy || (hcObjetivos?.length ?? 0) === 0) return;
    sincronizarHealthConnect(false)
      .then((res) => {
        if (res.ok) refrescarHoyYProgreso();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esHoy, hcObjetivos?.length]);

  // Al abrir / cambiar de día.
  useEffect(() => {
    autoSyncHC();
  }, [autoSyncHC]);

  // Al abrir la app: aplicar congeladores de racha si te salteaste algún día (idempotente).
  useEffect(() => {
    revisarCongeladores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al VOLVER a la app (primer plano): re-sincronizar así los pasos/calorías quedan al día solos.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') autoSyncHC();
    });
    return () => sub.remove();
  }, [autoSyncHC]);

  const guardarPaso = () => {
    if (!editando) return;
    const n = Number(texto.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) agregarPaso(editando.id_objetivo, n);
    setEditando(null);
    setTexto('');
  };
  const marcarSemanal = useMutation({
    mutationFn: ({ id, completado }: { id: string; completado: boolean }) =>
      guardarMarcar(id, fecha, completado),
    onMutate: async ({ id, completado }) => {
      await queryClient.cancelQueries({ queryKey: ['semanales-hoy', fecha] });
      const prev = queryClient.getQueryData<SemanalHoy[]>(['semanales-hoy', fecha]);
      queryClient.setQueryData<SemanalHoy[]>(['semanales-hoy', fecha], (old) =>
        (old ?? []).map((s) =>
          s.id_objetivo === id
            ? { ...s, completado_hoy: completado, hechos: Math.max(0, s.hechos + (completado ? 1 : -1)) }
            : s,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['semanales-hoy', fecha], ctx.prev);
    },
    onSuccess: (res, v) => {
      if (res === 'ok' && v.completado) revisarLogros();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['semanales-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
      queryClient.invalidateQueries({ queryKey: ['coleccion'] });
      invalidarPendientes();
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
    }) => guardarTarea(id, completada, prioridad),
    onMutate: async ({ id, completada }) => {
      await queryClient.cancelQueries({ queryKey: ['tareas'] });
      const prev = queryClient.getQueryData<Tarea[]>(['tareas']);
      queryClient.setQueryData<Tarea[]>(['tareas'], (old) =>
        (old ?? []).map((t) =>
          t.id_tarea === id
            ? { ...t, completada, fecha_completada: completada ? new Date().toISOString() : null }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tareas'], ctx.prev);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo.');
    },
    onSuccess: (res, v) => {
      if (res === 'ok' && v.completada) revisarLogros();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      // Las tareas ahora suman al % del día → refrescar Progreso (y la barra de XP/monedas).
      refrescarHoyYProgreso();
      invalidarPendientes();
    },
  });

  // Marcar/desmarcar un ítem de grupo adoptado desde el Hoy personal (optimista).
  const marcarGrupo = useMutation({
    mutationFn: ({ id, hecho }: { id: string; hecho: boolean }) => marcarItemGrupo(id, fecha, hecho),
    onMutate: async ({ id, hecho }) => {
      await queryClient.cancelQueries({ queryKey: ['items-hoy-grupos', fecha] });
      const prev = queryClient.getQueryData<ItemHoyGrupo[]>(['items-hoy-grupos', fecha]);
      queryClient.setQueryData<ItemHoyGrupo[]>(['items-hoy-grupos', fecha], (old) =>
        (old ?? []).map((i) => (i.id_item === id ? { ...i, hecho } : i)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['items-hoy-grupos', fecha], ctx.prev);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items-hoy-grupos'] });
      // Cambia el % del grupo y los puntos (no el personal) → refrescar sus vistas.
      queryClient.invalidateQueries({ queryKey: ['esperados-grupo'] });
      queryClient.invalidateQueries({ queryKey: ['progreso-grupo'] });
      queryClient.invalidateQueries({ queryKey: ['progreso-miembros'] });
      queryClient.invalidateQueries({ queryKey: ['mis-puntos-grupo'] });
      queryClient.invalidateQueries({ queryKey: ['puntos-miembros-grupo'] });
      queryClient.invalidateQueries({ queryKey: ['puntaje-total-grupo'] });
    },
  });

  const nadaHoy =
    !isLoading &&
    !isError &&
    booleanos.length === 0 &&
    numericos.length === 0 &&
    (semanales?.length ?? 0) === 0 &&
    (!esHoy || (tareasHoy.length === 0 && tareasProximas.length === 0));

  // "Recordá" separado por frecuencia: todos los días vs días específicos.
  const hayDuracion =
    numericos.some((o) => o.tipo === 'DURATION') || (semanales ?? []).some((s) => s.tipo === 'DURATION');
  const numDiarios = numericos.filter((o) => o.frecuencia_tipo === 'DAILY');
  const numDias = numericos.filter((o) => o.frecuencia_tipo === 'SPECIFIC_DAYS');

  // Abre la pantalla de foco (círculo) del cronómetro. Es feature PREMIUM → sin premium va al paywall.
  // El commit lo hace el provider al detener.
  const abrirCronometro = (id: string, nombre: string, meta: number | null, semanal: boolean) => {
    if (!esPremium) return router.push('/premium');
    router.push({
      pathname: '/cronometro/[id]',
      params: { id, fecha: hoy, nombre, meta: String(meta ?? ''), semanal: semanal ? '1' : '0' },
    });
  };

  // Render de un objetivo numérico/duración de "Recordá" (HC autocompletado / omitido / manual).
  const renderRecorda = (o: EsperadoHoy, ultimo: boolean) => {
    const cat = o.id_categoria ? catMap.get(o.id_categoria) : undefined;
    const valor = o.valor ?? 0;
    const esDur = o.tipo === 'DURATION';
    const cronoActivo = crono?.id === o.id_objetivo;
    // Con el cronómetro corriendo, el valor/progreso avanzan EN VIVO (valor + minutos en curso).
    const valorVivo = esDur && cronoActivo ? valor + cronoSeg / 60 : valor;
    const progresoVivo =
      esDur && cronoActivo && o.meta_valor ? Math.min(1, valorVivo / o.meta_valor) : creditoObjetivo(o);
    const [pasoChico, pasoGrande] = esDur ? pasosDuracion(o.meta_valor) : pasosNumericos(o.meta_valor);
    const mostrar = (n: number) => (esDur ? formatearMinutos(n) : fmt(n));
    const etiquetaPaso = (n: number) => (esDur ? `${fmt(n)}m` : fmt(n));
    const sumar = (paso: number) =>
      registrar.mutate({ id: o.id_objetivo, valor: valor + paso, meta: o.meta_valor });

    // Objetivo autocompletado desde Health Connect: sin botones manuales. En días anteriores
    // también se muestra (con "Actualizar") para poder completar un día que se pasó sin abrir la app.
    if (hcIds.has(o.id_objetivo)) {
      const esCal = metricaDeUnidad(o.unidad) === 'CALORIES';
      return (
        <View key={o.id_objetivo} style={[styles.recordaRow, ultimo && { borderBottomWidth: 0 }]}>
          <Text style={styles.recordaEmoji}>{iconoObjetivo(o, cat?.icono, esCal ? '🍎' : '👟')}</Text>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                <Pressable onPress={() => router.push(`/objetivo/info/${o.id_objetivo}?fecha=${fecha}`)}>
                  <Text style={styles.itemLabel}>{o.nombre}</Text>
                </Pressable>
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
        <View key={o.id_objetivo} style={[styles.recordaRow, ultimo && { borderBottomWidth: 0 }]}>
          <Text style={[styles.recordaEmoji, { opacity: 0.4 }]}>{iconoObjetivo(o, cat?.icono)}</Text>
          <Text style={[styles.itemLabel, { flex: 1, opacity: 0.5 }]}>{o.nombre} · omitido</Text>
          <Pressable onPress={() => omitir.mutate({ id: o.id_objetivo, valor: false })} hitSlop={8}>
            <Text style={styles.link}>Deshacer</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View key={o.id_objetivo} style={[styles.recordaRow, ultimo && { borderBottomWidth: 0 }]}>
        <Text style={styles.recordaEmoji}>{iconoObjetivo(o, cat?.icono)}</Text>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={styles.rowBetween}>
            <Pressable style={{ flex: 1 }} onPress={() => router.push(`/objetivo/info/${o.id_objetivo}?fecha=${fecha}`)}>
              <Text style={styles.itemLabel}>{o.nombre}</Text>
            </Pressable>
            <Text style={styles.muted}>
              {esDur
                ? `${mostrar(valorVivo)} / ${formatearMinutos(o.meta_valor ?? 0)}`
                : `${fmt(valor)}/${o.meta_valor} ${o.unidad ?? ''}`}
            </Text>
          </View>
          <ProgressBar progress={progresoVivo} color={colors.purple} />
          <View style={styles.stepRow}>
            {esDur && esPremium && (
              <Pressable
                style={[styles.cronoBtn, cronoActivo && styles.cronoBtnOn]}
                onPress={() => abrirCronometro(o.id_objetivo, o.nombre, o.meta_valor, false)}>
                <Ionicons name={cronoActivo ? 'stop' : 'timer-outline'} size={13} color={cronoActivo ? '#fff' : colors.purple} />
                <Text style={[styles.stepText, cronoActivo && { color: '#fff' }]}>
                  {cronoActivo ? mmss(cronoSeg) : 'Cronómetro 👑'}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.stepBtnMinus} onPress={() => sumar(-pasoGrande)}>
              <Text style={styles.stepTextMinus}>−{etiquetaPaso(pasoGrande)}</Text>
            </Pressable>
            <Pressable style={styles.stepBtnMinus} onPress={() => sumar(-pasoChico)}>
              <Text style={styles.stepTextMinus}>−{etiquetaPaso(pasoChico)}</Text>
            </Pressable>
            <Pressable style={styles.stepBtn} onPress={() => sumar(pasoChico)}>
              <Text style={styles.stepText}>+{etiquetaPaso(pasoChico)}</Text>
            </Pressable>
            <Pressable style={styles.stepBtn} onPress={() => sumar(pasoGrande)}>
              <Text style={styles.stepText}>+{etiquetaPaso(pasoGrande)}</Text>
            </Pressable>
            {(pasosCustom[o.id_objetivo] ?? []).map((v) => (
              <Pressable
                key={v}
                style={styles.stepBtn}
                onPress={() => sumar(v)}
                onLongPress={() => quitarPaso(o.id_objetivo, v)}>
                <Text style={styles.stepText}>+{etiquetaPaso(v)}</Text>
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
  };

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

        {/* Navegador de día: ver y marcar días anteriores (para lo olvidado) y volver a hoy. */}
        <View style={styles.diaNav}>
          <Pressable
            style={[styles.diaNavBtn, !puedeAtras && styles.diaNavBtnOff]}
            hitSlop={8}
            disabled={!puedeAtras}
            onPress={() => setFecha((f) => sumarDiasISO(f, -1))}>
            <Ionicons name="chevron-back" size={20} color={puedeAtras ? colors.purple : colors.textMuted} />
          </Pressable>
          <View style={styles.diaNavLabel}>
            <Text style={styles.diaNavText}>{esHoy ? 'Hoy' : fechaLargaConDia(fecha)}</Text>
            {!esHoy && (
              <Pressable hitSlop={6} onPress={() => setFecha(hoy)}>
                <Text style={styles.diaNavHoy}>Volver a hoy</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            style={[styles.diaNavBtn, esHoy && styles.diaNavBtnOff]}
            hitSlop={8}
            disabled={esHoy}
            onPress={() => setFecha((f) => sumarDiasISO(f, 1))}>
            <Ionicons name="chevron-forward" size={20} color={esHoy ? colors.textMuted : colors.purple} />
          </Pressable>
        </View>

        {/* Aviso de cambios hechos sin internet (se suben solos al reconectar). */}
        {pendientes > 0 && (
          <View style={styles.pendientesBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.purple} />
            <Text style={styles.pendientesText}>
              {pendientes === 1 ? 'Tenés 1 cambio sin guardar' : `Tenés ${pendientes} cambios sin guardar`}. Se
              suben solos cuando vuelva internet.
            </Text>
          </View>
        )}

        {/* Cronómetros (Premium): tus objetivos con tiempo, todos juntos. */}
        {esHoy && hayDuracion && (
          <Pressable
            style={styles.cronosCard}
            onPress={() => router.push(esPremium ? '/cronometros' : '/premium')}>
            <View style={styles.cronosIcon}>
              <Ionicons name="timer-outline" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cronosTitulo}>Cronómetros</Text>
              <Text style={styles.cronosSub}>Tus objetivos con tiempo, todos juntos</Text>
            </View>
            <PremiumBadge bloqueado={!esPremium} tone="light" />
          </Pressable>
        )}

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
          <View style={{ marginTop: spacing.lg, gap: 14 }}>
            <EstadoMensaje
              conDragon
              titulo="No tenés nada para hoy 🎉"
              subtitulo="Creá tu primer objetivo o tarea y van a aparecer acá."
            />
            <View style={styles.crearRow}>
              <Pressable style={styles.crearBtn} onPress={() => router.push('/objetivo/nuevo')}>
                <Ionicons name="add" size={17} color="#fff" />
                <Text style={styles.crearBtnText}>Objetivo</Text>
              </Pressable>
              <Pressable style={styles.crearBtnGhost} onPress={() => router.push('/tarea/nuevo')}>
                <Ionicons name="add" size={17} color={colors.purple} />
                <Text style={styles.crearBtnGhostText}>Tarea</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Tareas de hoy (arriba, y no desaparecen al marcarlas: se ven hechas todo el día) */}
        {esHoy && tareasHoy.length > 0 && (
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
                    <Pressable style={{ flex: 1 }} onPress={() => router.push(`/tarea/info/${t.id_tarea}`)}>
                      <Text style={[styles.itemLabel, t.completada && styles.goalTitleDone]}>{t.titulo}</Text>
                    </Pressable>
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
              {booleanos.map((o, i) => {
                const ultimo = i === booleanos.length - 1;
                if (o.omitido) {
                  return (
                    <View key={o.id_objetivo} style={[styles.checkline, ultimo && { borderBottomWidth: 0 }]}>
                      <View style={[styles.checkbox, { opacity: 0.4 }]} />
                      <Text style={[styles.goalTitle, { flex: 1, opacity: 0.5 }]}>{o.nombre} · omitido</Text>
                      <Pressable onPress={() => omitir.mutate({ id: o.id_objetivo, valor: false })} hitSlop={8}>
                        <Text style={styles.link}>Deshacer</Text>
                      </Pressable>
                    </View>
                  );
                }
                return (
                  <View key={o.id_objetivo} style={[styles.checkline, ultimo && { borderBottomWidth: 0 }]}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => marcar.mutate({ id: o.id_objetivo, completado: !o.completado })}>
                      <View style={[styles.checkbox, o.completado && styles.checkboxDonePurple]}>
                        {o.completado && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </Pressable>
                    <Pressable
                      style={styles.infoTap}
                      onPress={() => router.push(`/objetivo/info/${o.id_objetivo}?fecha=${fecha}`)}>
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
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Recordá — primero los de HOY (días puntuales), después los de todos los días */}
        {numDias.length > 0 && (
          <>
            <SectionHeader
              icon="today-outline"
              iconColor={colors.blue}
              title="Recordá hoy"
              subtitle="Recorda cumplirlos durante el dia"
            />
            <Card style={{ paddingVertical: 4 }}>
              {numDias.map((o, i) => renderRecorda(o, i === numDias.length - 1))}
            </Card>
          </>
        )}
        {numDiarios.length > 0 && (
          <>
            <SectionHeader
              icon="water-outline"
              iconColor={colors.blue}
              title="Recordá todos los días"
              subtitle="Pequeños hábitos, grandes cambios"
            />
            <Card style={{ paddingVertical: 4 }}>
              {numDiarios.map((o, i) => renderRecorda(o, i === numDiarios.length - 1))}
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
                const esBool = s.tipo === 'BOOLEAN';
                const esDur = s.tipo === 'DURATION';
                const cronoAct = crono?.id === s.id_objetivo;
                const hechosVivo = esDur && cronoAct ? s.hechos + cronoSeg / 60 : s.hechos;
                const [pChico, pGrande] = esDur ? pasosDuracion(meta) : pasosNumericos(meta);
                const etq = (n: number) => (esDur ? `${fmt(n)}m` : fmt(n));
                const mostrarSem = (n: number) =>
                  esDur ? formatearMinutos(n) : `${fmt(n)}${s.unidad ? ` ${s.unidad}` : ''}`;
                const sumarSem = (delta: number) =>
                  sumarSemanal.mutate({ id: s.id_objetivo, fecha: hoy, delta });
                return (
                  <View key={s.id_objetivo} style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={styles.rowBetween}>
                          <Pressable style={{ flex: 1 }} onPress={() => router.push(`/objetivo/info/${s.id_objetivo}`)}>
                            <Text style={styles.itemLabel}>{s.nombre}</Text>
                          </Pressable>
                          <Text style={styles.muted}>
                            {esBool ? `${s.hechos}/${meta}` : `${mostrarSem(hechosVivo)} / ${mostrarSem(meta)}`}
                          </Text>
                        </View>
                        <ProgressBar progress={meta > 0 ? hechosVivo / meta : 0} color={colors.green} />
                      </View>
                      {esBool && (
                        <Pressable
                          onPress={() => marcarSemanal.mutate({ id: s.id_objetivo, completado: !s.completado_hoy })}
                          style={[styles.semanalBtn, s.completado_hoy && styles.semanalBtnOn]}>
                          <Ionicons name="checkmark" size={16} color={s.completado_hoy ? '#fff' : colors.green} />
                        </Pressable>
                      )}
                    </View>
                    {!esBool && esHoy && (
                      <View style={styles.stepRow}>
                        {esDur && esPremium && (
                          <Pressable
                            style={[styles.cronoBtn, cronoAct && styles.cronoBtnOn]}
                            onPress={() => abrirCronometro(s.id_objetivo, s.nombre, meta, true)}>
                            <Ionicons name={cronoAct ? 'stop' : 'timer-outline'} size={13} color={cronoAct ? '#fff' : colors.purple} />
                            <Text style={[styles.stepText, cronoAct && { color: '#fff' }]}>
                              {cronoAct ? mmss(cronoSeg) : 'Cronómetro 👑'}
                            </Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.stepBtnMinus} onPress={() => sumarSem(-pGrande)}>
                          <Text style={styles.stepTextMinus}>−{etq(pGrande)}</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtnMinus} onPress={() => sumarSem(-pChico)}>
                          <Text style={styles.stepTextMinus}>−{etq(pChico)}</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtn} onPress={() => sumarSem(pChico)}>
                          <Text style={styles.stepText}>+{etq(pChico)}</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtn} onPress={() => sumarSem(pGrande)}>
                          <Text style={styles.stepText}>+{etq(pGrande)}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Tareas próximas (mañana en adelante, esta semana) */}
        {esHoy && tareasProximas.length > 0 && (
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
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/tarea/info/${t.id_tarea}`)}>
                    <Text style={styles.itemLabel}>{t.titulo}</Text>
                  </Pressable>
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

        {/* De mis grupos — ítems que agregué a mi Hoy (suman al grupo, no a mi % personal) */}
        {(itemsGrupos?.length ?? 0) > 0 && (
          <>
            <SectionHeader
              icon="people-outline"
              iconColor={colors.purple}
              title="De mis grupos"
              subtitle="Suman al progreso del grupo"
            />
            <View style={{ gap: 10 }}>
              {itemsGrupos!.map((g) => (
                <Card key={g.id_item} style={styles.listRow}>
                  <Pressable
                    hitSlop={6}
                    disabled={!g.puedo_marcar}
                    onPress={() => marcarGrupo.mutate({ id: g.id_item, hecho: !g.hecho })}>
                    <View style={[styles.checkbox, g.hecho && styles.checkboxDonePurple, !g.puedo_marcar && { opacity: 0.4 }]}>
                      {g.hecho && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, g.hecho && styles.goalTitleDone]}>
                      {g.icono ? `${g.icono} ` : ''}
                      {g.titulo}
                    </Text>
                    <Text style={styles.muted}>{g.grupo_nombre}</Text>
                  </View>
                  <View style={[styles.chip, styles.chipGrupo]}>
                    <Text style={styles.chipText}>Grupo</Text>
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
                    setEditando(null);
                    setTexto('');
                  }}>
                  <Text style={styles.link}>Cancelar</Text>
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
            <Text style={styles.modalTitle}>🍽️ Comidas {esHoy ? 'de hoy' : `· ${fechaLargaConDia(fecha)}`}</Text>
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
  cronosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.purple,
    borderRadius: 18,
    padding: 14,
  },
  cronosIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff33',
  },
  cronosTitulo: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cronosSub: { color: '#ffffffcc', fontSize: 12.5, marginTop: 1 },
  pendientesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.purple100,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pendientesText: { flex: 1, color: colors.purple700, fontSize: 12.5, fontWeight: '600' },
  diaNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  diaNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  diaNavBtnOff: { opacity: 0.4 },
  diaNavLabel: { flex: 1, alignItems: 'center' },
  diaNavText: { fontSize: 14, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  diaNavHoy: { fontSize: 12, fontWeight: '700', color: colors.purple, marginTop: 1 },
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
  crearRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  crearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.purple,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  crearBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  crearBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.purple,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  crearBtnGhostText: { color: colors.purple, fontWeight: '800', fontSize: 14 },
  infoTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  cronoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.purple,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 74,
    justifyContent: 'center',
  },
  cronoBtnOn: { backgroundColor: colors.purple, borderColor: colors.purple },
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
  chipGrupo: { backgroundColor: colors.purple100 },
  chipText: { fontSize: 11, fontWeight: '800', color: colors.text },
});
