import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DragonHero } from '@/components/DragonHero';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { spacing, type Tema } from '@/constants/theme';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';
import { estadoDragon } from '@/logic/dragon';
import {
  adoptarItem,
  agregarPlaceholder,
  type AsignacionItem,
  asignacionesItem,
  borrarItemGrupo,
  crearItemGrupo,
  detalleGrupo,
  editarItemGrupo,
  eliminarGrupo,
  type EsperadoGrupo,
  esperadosGrupo,
  generarInvitacion,
  type ItemGrupoFull,
  marcarItemMiembro,
  type MiembroGrupo,
  miembrosGrupo,
  misAdopcionesGrupo,
  misPuntosGrupo,
  type NuevoItemGrupo,
  obtenerItemGrupo,
  setAsignacionesItem,
  type ProgresoMiembro,
  progresoGrupo,
  progresoMiembros,
  puntajeTotalMiembros,
  quitarAdopcion,
  sacarMiembro,
  salirGrupo,
  type SemanalGrupo,
  semanalesGrupo,
  transferirAdmin,
} from '@/lib/data';
import { DateTimeField } from '@/components/ui/DateTimeField';
import {
  dateAHora,
  dateAISO,
  fechaLarga,
  fechaLargaConDia,
  horaActual,
  horaADate,
  hoyISO,
  inicioSemanaISO,
  isoADate,
  primerDiaMesISO,
  sumarDiasISO,
} from '@/logic/fecha';

const DIAS_CORTO = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // índice = ISO 1..7
const EMOJIS_ITEM = [
  '🎯', '✅', '🔁', '⭐', '🏠', '🧹', '🧺', '🍽️', '🍳', '🛒', '🗑️', '🚿',
  '🛏️', '🧼', '💧', '🌱', '🪴', '🐕', '🐈', '📚', '✏️', '💼', '💻', '📞',
  '💪', '🏃', '🧘', '⚽', '🚴', '💊', '🩺', '🦷', '💰', '🎵', '🎨', '🍎',
];

/** Forma unificada para el modal de info (sirve para ítems normales y "X veces por semana"). */
type ItemInfo = {
  id_item: string;
  titulo: string;
  descripcion: string | null;
  icono: string | null;
  tipo: 'TAREA' | 'OBJETIVO';
  frecuencia: 'DIARIA' | 'DIAS' | 'SEMANAL' | null;
  dias: number[] | null;
  veces_semana: number | null;
  fecha_fin: string | null;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | null;
  fecha_limite: string | null;
  hora_limite: string | null;
  asignado_nombre: string | null;
  puedo_editar: boolean;
  puedo_adoptar: boolean; // solo si es mío o sin asignar (no por ser admin)
  adoptado: boolean; // si el usuario lo agregó a su Hoy personal
};

function espToInfo(i: EsperadoGrupo, adoptado: boolean): ItemInfo {
  return {
    id_item: i.id_item,
    titulo: i.titulo,
    descripcion: i.descripcion,
    icono: i.icono,
    tipo: i.tipo,
    frecuencia: i.frecuencia,
    dias: i.dias,
    veces_semana: null,
    fecha_fin: i.fecha_fin,
    prioridad: i.prioridad,
    fecha_limite: i.fecha_limite,
    hora_limite: i.hora_limite,
    asignado_nombre: i.asignado_nombre,
    puedo_editar: i.puedo_editar,
    puedo_adoptar: i.mio || i.id_miembro_asignado === null,
    adoptado,
  };
}

function semToInfo(i: SemanalGrupo, adoptado: boolean): ItemInfo {
  return {
    id_item: i.id_item,
    titulo: i.titulo,
    descripcion: i.descripcion,
    icono: i.icono,
    tipo: 'OBJETIVO',
    frecuencia: 'SEMANAL',
    dias: null,
    veces_semana: i.veces_semana,
    fecha_fin: null,
    prioridad: null,
    fecha_limite: null,
    hora_limite: null,
    asignado_nombre: i.asignado_nombre,
    puedo_editar: i.puedo_editar,
    puedo_adoptar: i.mio || i.id_miembro_asignado === null,
    adoptado,
  };
}

function resumenItem(i: Pick<ItemInfo, 'tipo' | 'frecuencia' | 'dias' | 'veces_semana'>): string {
  if (i.tipo === 'TAREA') return 'Tarea';
  if (i.frecuencia === 'DIARIA') return 'Todos los días';
  if (i.frecuencia === 'DIAS' && i.dias?.length) return i.dias.map((d) => DIAS_CORTO[d]).join(', ');
  if (i.frecuencia === 'SEMANAL') return `${i.veces_semana ?? 1} ${(i.veces_semana ?? 1) === 1 ? 'vez' : 'veces'} por semana`;
  return 'Objetivo';
}

type Pestana = 'tareas' | 'progreso' | 'miembros';
type RangoProgreso = 'dia' | 'semana' | 'mes';

export default function GrupoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idGrupo = String(id);
  const colors = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [pestana, setPestana] = useState<Pestana>('tareas');
  const [addAbierto, setAddAbierto] = useState(false); // modal "agregar por nombre"
  const [menuAbierto, setMenuAbierto] = useState(false); // menú "agregar o invitar"
  const [linkCodigo, setLinkCodigo] = useState<string | null>(null); // muestra el link generado
  const [crearTipo, setCrearTipo] = useState<'TAREA' | 'OBJETIVO' | null>(null); // modal crear (según botón)
  const [fecha, setFecha] = useState(hoyISO()); // día que se está viendo en "Tareas y objetivos"
  const [rango, setRango] = useState<RangoProgreso>('dia'); // rango de la pestaña Progreso
  const [info, setInfo] = useState<ItemInfo | null>(null); // ítem cuyo detalle se muestra
  const [editarItem, setEditarItem] = useState<ItemGrupoFull | null>(null); // ítem que se está editando

  const { data: grupo } = useQuery({ queryKey: ['grupo', idGrupo], queryFn: () => detalleGrupo(idGrupo) });
  const {
    data: miembros,
    isLoading: cargandoMiembros,
    isError: errorMiembros,
    refetch: refetchMiembros,
  } = useQuery({ queryKey: ['miembros', idGrupo], queryFn: () => miembrosGrupo(idGrupo) });
  const { data: esperados, isLoading: cargandoItems } = useQuery({
    queryKey: ['esperados-grupo', idGrupo, fecha],
    queryFn: () => esperadosGrupo(idGrupo, fecha),
  });
  const { data: semanales } = useQuery({
    queryKey: ['semanales-grupo', idGrupo, fecha],
    queryFn: () => semanalesGrupo(idGrupo, fecha),
  });
  const { data: progreso } = useQuery({
    queryKey: ['progreso-grupo', idGrupo, fecha],
    queryFn: () => progresoGrupo(idGrupo, fecha),
  });
  const assetKeyDragon = useDragonEquipado();
  const { data: adopciones } = useQuery({
    queryKey: ['mis-adopciones', idGrupo],
    queryFn: () => misAdopcionesGrupo(idGrupo),
  });
  const adoptadas = new Set(adopciones ?? []);

  // Rango de la pestaña Progreso: siempre hasta HOY (no contar días futuros como esperados).
  const hoy = hoyISO();
  const desdeRango =
    rango === 'dia' ? hoy : rango === 'semana' ? inicioSemanaISO(hoy) : primerDiaMesISO(hoy);
  const { data: progresoMiembrosData, isLoading: cargandoProgreso } = useQuery({
    queryKey: ['progreso-miembros', idGrupo, desdeRango, hoy],
    queryFn: () => progresoMiembros(idGrupo, desdeRango, hoy),
    enabled: pestana === 'progreso',
  });
  const { data: misPuntos = 0 } = useQuery({
    queryKey: ['mis-puntos-grupo', idGrupo],
    queryFn: () => misPuntosGrupo(idGrupo),
    enabled: pestana === 'progreso',
  });
  const { data: puntajeTotal } = useQuery({
    queryKey: ['puntaje-total-grupo', idGrupo],
    queryFn: () => puntajeTotalMiembros(idGrupo),
    enabled: pestana === 'progreso',
  });

  const esAdmin = grupo?.es_admin === true;

  const qc = useQueryClient();

  // Genera un link de invitación (opcionalmente atado a un placeholder) y lo muestra.
  const invitar = useMutation({
    mutationFn: (idDestino?: string | null) => generarInvitacion(idGrupo, idDestino ?? null),
    onSuccess: (codigo) => {
      setMenuAbierto(false);
      setLinkCodigo(codigo);
    },
    onError: (e) => Alert.alert('No se pudo generar el link', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const sacar = useMutation({
    mutationFn: (idMiembro: string) => sacarMiembro(idMiembro),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['miembros', idGrupo] });
      qc.invalidateQueries({ queryKey: ['grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['mis-grupos'] });
    },
    onError: (e) => Alert.alert('No se pudo sacar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const salirOEliminar = useMutation({
    mutationFn: () => (esAdmin ? eliminarGrupo(idGrupo) : salirGrupo(idGrupo)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-grupos'] });
      router.back();
    },
    onError: (e) => Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const transferir = useMutation({
    mutationFn: (idMiembro: string) => transferirAdmin(idMiembro),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['miembros', idGrupo] });
      qc.invalidateQueries({ queryKey: ['grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['mis-grupos'] });
    },
    onError: (e) => Alert.alert('No se pudo transferir', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  function confirmarSacar(m: MiembroGrupo) {
    Alert.alert('Sacar del grupo', `¿Sacar a ${m.nombre} del grupo?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sacar', style: 'destructive', onPress: () => sacar.mutate(m.id_miembro) },
    ]);
  }

  function confirmarTransferir(m: MiembroGrupo) {
    Alert.alert(
      'Hacer admin',
      `¿Pasar a ${m.nombre} como admin del grupo? Vos dejás de ser admin (seguís como miembro).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Hacer admin', onPress: () => transferir.mutate(m.id_miembro) },
      ],
    );
  }

  function confirmarSalir() {
    if (esAdmin) {
      Alert.alert('Eliminar grupo', 'Se elimina el grupo para todos, con sus tareas. ¿Seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => salirOEliminar.mutate() },
      ]);
    } else {
      Alert.alert('Salir del grupo', '¿Salir de este grupo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => salirOEliminar.mutate() },
      ]);
    }
  }

  // Marcar/desmarcar la instancia de una persona (id_miembro) en la fecha que se está viendo.
  const marcar = useMutation({
    mutationFn: ({ id, idMiembro, hecho }: { id: string; idMiembro: string | null; hecho: boolean }) =>
      marcarItemMiembro(id, fecha, idMiembro, hecho),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['esperados-grupo', idGrupo, fecha] });
      qc.invalidateQueries({ queryKey: ['semanales-grupo', idGrupo, fecha] });
      qc.invalidateQueries({ queryKey: ['progreso-grupo', idGrupo, fecha] });
      qc.invalidateQueries({ queryKey: ['progreso-miembros', idGrupo] });
      qc.invalidateQueries({ queryKey: ['mis-puntos-grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['puntos-miembros-grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['puntaje-total-grupo', idGrupo] });
    },
    onError: (e) => Alert.alert('No se pudo marcar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => borrarItemGrupo(id),
    onSuccess: () => {
      for (const k of ['esperados-grupo', 'semanales-grupo', 'progreso-grupo'])
        qc.invalidateQueries({ queryKey: [k, idGrupo, fecha] });
      setInfo(null);
    },
    onError: (e) => Alert.alert('No se pudo borrar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  // Abre el formulario de editar precargado con los datos completos del ítem.
  async function abrirEditar(id: string) {
    try {
      const full = await obtenerItemGrupo(id);
      if (!full) return;
      setInfo(null);
      setEditarItem(full);
      setCrearTipo(full.tipo);
    } catch {
      Alert.alert('No se pudo abrir', 'Intentá de nuevo.');
    }
  }

  function confirmarBorrar(item: ItemInfo) {
    Alert.alert('Borrar', `¿Borrar “${item.titulo}”? Se elimina para todo el grupo.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => borrar.mutate(item.id_item) },
    ]);
  }

  // Adoptar/quitar un ítem de grupo a mi Hoy personal.
  const adopcionMut = useMutation({
    mutationFn: ({ id, adoptar }: { id: string; adoptar: boolean }) =>
      adoptar ? adoptarItem(id) : quitarAdopcion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-adopciones', idGrupo] });
      qc.invalidateQueries({ queryKey: ['items-hoy-grupos'] });
    },
    onError: (e) => Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });
  function toggleAdopcion(id: string, adoptar: boolean) {
    setInfo((prev) => (prev && prev.id_item === id ? { ...prev, adoptado: adoptar } : prev));
    adopcionMut.mutate({ id, adoptar });
  }

  const esHoy = fecha === hoyISO();
  const objetivosMios = (esperados ?? []).filter((i) => i.tipo === 'OBJETIVO' && i.mio);
  const objetivosOtros = (esperados ?? []).filter((i) => i.tipo === 'OBJETIVO' && !i.mio);
  const tareasMias = (esperados ?? []).filter((i) => i.tipo === 'TAREA' && i.mio);
  const tareasOtras = (esperados ?? []).filter((i) => i.tipo === 'TAREA' && !i.mio);
  const semanalesMios = (semanales ?? []).filter((i) => i.mio);
  const semanalesOtros = (semanales ?? []).filter((i) => !i.mio);
  const hayObjetivos =
    objetivosMios.length + objetivosOtros.length + semanalesMios.length + semanalesOtros.length > 0;
  const hayTareas = tareasMias.length + tareasOtras.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.tituloWrap}>
          <Text style={styles.tituloIcono}>{grupo?.icono ?? '👥'}</Text>
          <Text style={styles.titulo} numberOfLines={1}>
            {grupo?.nombre ?? 'Grupo'}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Sub-pestañas Tareas / Progreso / Miembros */}
      <View style={styles.tabs}>
        <TabBtn texto="Tareas y objetivos" activo={pestana === 'tareas'} onPress={() => setPestana('tareas')} colors={colors} />
        <TabBtn texto="Progreso" activo={pestana === 'progreso'} onPress={() => setPestana('progreso')} colors={colors} />
        <TabBtn texto="Miembros" activo={pestana === 'miembros'} onPress={() => setPestana('miembros')} colors={colors} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {pestana === 'tareas' ? (
          <>
            <View style={styles.hero}>
              <DragonHero
                estado={(progreso?.esperados ?? 0) > 0 ? estadoDragon(progreso?.pct ?? 0, horaActual()) : 'animo'}
                assetKey={assetKeyDragon}
                width={78}
                height={108}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitulo}>Progreso del grupo</Text>
                <Text style={styles.heroPct}>{progreso?.pct ?? 0}%</Text>
                <ProgressBar progress={(progreso?.pct ?? 0) / 100} />
                <Text style={styles.heroSub}>
                  {(progreso?.esperados ?? 0) > 0
                    ? `${progreso?.hechos ?? 0} de ${progreso?.esperados ?? 0} hechos ${esHoy ? 'hoy' : 'ese día'}`
                    : 'Sin objetivos ni tareas este día'}
                </Text>
              </View>
            </View>

            <View style={styles.navDia}>
              <Pressable onPress={() => setFecha(sumarDiasISO(fecha, -1))} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.purple} />
              </Pressable>
              <Text style={styles.navDiaText}>{esHoy ? 'Hoy' : fechaLargaConDia(fecha)}</Text>
              <Pressable onPress={() => setFecha(sumarDiasISO(fecha, 1))} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={colors.purple} />
              </Pressable>
            </View>
            {!esHoy && (
              <Pressable onPress={() => setFecha(hoyISO())} style={{ alignSelf: 'center', marginBottom: 6 }}>
                <Text style={styles.volverHoy}>Volver a hoy</Text>
              </Pressable>
            )}

            {cargandoItems ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.purple} />
            ) : (
              <View style={{ gap: 18, marginTop: 8 }}>
                {/* OBJETIVOS */}
                <View>
                  <Text style={styles.seccionHeader}>Objetivos</Text>
                  <Card style={styles.bloque}>
                    {hayObjetivos ? (
                      <>
                        {objetivosMios.length + semanalesMios.length > 0 && (
                          <View style={{ gap: 6 }}>
                            <Text style={styles.subTitulo}>Para vos</Text>
                            {objetivosMios.map((it) => (
                              <ItemMarcable key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={(id, idm, h) => marcar.mutate({ id, idMiembro: idm, hecho: h })} onInfo={(x) => setInfo(espToInfo(x, adoptadas.has(x.id_item)))} colors={colors} />
                            ))}
                            {semanalesMios.map((it) => (
                              <SemanalRow key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={(id, idm, h) => marcar.mutate({ id, idMiembro: idm, hecho: h })} onInfo={(x) => setInfo(semToInfo(x, adoptadas.has(x.id_item)))} colors={colors} />
                            ))}
                          </View>
                        )}
                        {objetivosOtros.length + semanalesOtros.length > 0 && (
                          <View style={{ gap: 6 }}>
                            <Text style={styles.subTitulo}>Del grupo</Text>
                            {objetivosOtros.map((it) => (
                              <ItemMarcable key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={(id, idm, h) => marcar.mutate({ id, idMiembro: idm, hecho: h })} onInfo={(x) => setInfo(espToInfo(x, adoptadas.has(x.id_item)))} colors={colors} />
                            ))}
                            {semanalesOtros.map((it) => (
                              <SemanalRow key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={(id, idm, h) => marcar.mutate({ id, idMiembro: idm, hecho: h })} onInfo={(x) => setInfo(semToInfo(x, adoptadas.has(x.id_item)))} colors={colors} />
                            ))}
                          </View>
                        )}
                        <BotonAgregar etiqueta="Objetivo" onPress={() => setCrearTipo('OBJETIVO')} colors={colors} />
                      </>
                    ) : (
                      <VacioSeccion texto="No tenés objetivos" etiqueta="Objetivo" onPress={() => setCrearTipo('OBJETIVO')} colors={colors} />
                    )}
                  </Card>
                </View>

                {/* TAREAS */}
                <View>
                  <Text style={styles.seccionHeader}>Tareas</Text>
                  <Card style={styles.bloque}>
                    {hayTareas ? (
                      <>
                        {tareasMias.length > 0 && (
                          <View style={{ gap: 6 }}>
                            <Text style={styles.subTitulo}>Para vos</Text>
                            {tareasMias.map((it) => (
                              <ItemMarcable key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={(id, idm, h) => marcar.mutate({ id, idMiembro: idm, hecho: h })} onInfo={(x) => setInfo(espToInfo(x, adoptadas.has(x.id_item)))} colors={colors} />
                            ))}
                          </View>
                        )}
                        {tareasOtras.length > 0 && (
                          <View style={{ gap: 6 }}>
                            <Text style={styles.subTitulo}>Del grupo</Text>
                            {tareasOtras.map((it) => (
                              <ItemMarcable key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={(id, idm, h) => marcar.mutate({ id, idMiembro: idm, hecho: h })} onInfo={(x) => setInfo(espToInfo(x, adoptadas.has(x.id_item)))} colors={colors} />
                            ))}
                          </View>
                        )}
                        <BotonAgregar etiqueta="Tarea" onPress={() => setCrearTipo('TAREA')} colors={colors} />
                      </>
                    ) : (
                      <VacioSeccion texto="No tenés tareas" etiqueta="Tarea" onPress={() => setCrearTipo('TAREA')} colors={colors} />
                    )}
                  </Card>
                </View>
              </View>
            )}
          </>
        ) : pestana === 'progreso' ? (
          <>
            {/* Puntos y recompensas */}
            <Pressable
              style={styles.recompensasCard}
              onPress={() => router.push({ pathname: '/grupo/recompensas', params: { id: idGrupo } })}>
              <Text style={{ fontSize: 26 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recompensasTitulo}>Recompensas</Text>
                <Text style={styles.recompensasSub}>Tenés ⭐ {misPuntos} puntos</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.purple} />
            </Pressable>

            {/* Selector de rango */}
            <View style={styles.rangoRow}>
              {(['dia', 'semana', 'mes'] as RangoProgreso[]).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.rangoBtn, rango === r && styles.rangoBtnOn]}
                  onPress={() => setRango(r)}>
                  <Text style={[styles.rangoBtnText, rango === r && styles.rangoBtnTextOn]}>
                    {r === 'dia' ? 'Hoy' : r === 'semana' ? 'Semana' : 'Mes'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {cargandoProgreso ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.purple} />
            ) : (
              (() => {
                const lista = progresoMiembrosData ?? [];
                const totalEsp = lista.reduce((a, m) => a + m.esperados, 0);
                const totalHec = lista.reduce((a, m) => a + m.hechos, 0);
                const pctGrupo = totalEsp > 0 ? Math.round((100 * totalHec) / totalEsp) : 0;
                return (
                  <View style={{ gap: 14, marginTop: 6 }}>
                    {/* Total del grupo en el rango */}
                    <Card style={styles.progGrupoCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.progGrupoTitulo}>Grupo</Text>
                        <Text style={styles.progGrupoPct}>{pctGrupo}%</Text>
                      </View>
                      <ProgressBar progress={pctGrupo / 100} />
                      <Text style={styles.progGrupoSub}>
                        {totalEsp > 0
                          ? `${totalHec} de ${totalEsp} cumplidos`
                          : 'Sin nada asignado en este período'}
                      </Text>
                    </Card>

                    {/* Cada miembro */}
                    {lista.map((m) => (
                      <MiembroProgresoRow key={m.id_miembro} m={m} colors={colors} />
                    ))}

                    {/* Ranking histórico: quién hizo más en general (no baja al canjear) */}
                    {(puntajeTotal?.length ?? 0) > 0 && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.seccionHeader}>🏆 Quién hizo más</Text>
                        <Card style={{ gap: 10 }}>
                          {puntajeTotal!.map((m, i) => (
                            <View key={m.id_miembro} style={styles.rankRow}>
                              <Text style={styles.rankPos}>{i + 1}</Text>
                              <Text
                                style={[styles.rankNombre, m.es_yo && { fontWeight: '800', color: colors.purple }]}
                                numberOfLines={1}>
                                {m.nombre}
                                {m.es_yo ? ' (vos)' : ''}
                              </Text>
                              <Text style={styles.rankPts}>⭐ {m.puntaje}</Text>
                            </View>
                          ))}
                        </Card>
                      </View>
                    )}
                  </View>
                );
              })()
            )}
          </>
        ) : (
          <>
            {esAdmin && (
              <Pressable style={styles.addBtn} onPress={() => setMenuAbierto(true)}>
                <Ionicons name="person-add-outline" size={17} color={colors.purple} />
                <Text style={styles.addBtnText}>Agregar o invitar</Text>
              </Pressable>
            )}

            {cargandoMiembros ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.purple} />
            ) : errorMiembros ? (
              <Pressable style={styles.errorBox} onPress={() => refetchMiembros()}>
                <Text style={styles.errorText}>
                  No se pudieron cargar los miembros. Tocá para reintentar.
                </Text>
              </Pressable>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                {(miembros ?? []).map((m) => (
                  <MiembroRow
                    key={m.id_miembro}
                    m={m}
                    esAdmin={esAdmin}
                    invitando={invitar.isPending}
                    onInvitar={() => invitar.mutate(m.id_miembro)}
                    onSacar={() => confirmarSacar(m)}
                    onHacerAdmin={() => confirmarTransferir(m)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            <Pressable style={styles.salirBtn} onPress={confirmarSalir} disabled={salirOEliminar.isPending}>
              <Ionicons name={esAdmin ? 'trash-outline' : 'exit-outline'} size={17} color={colors.red} />
              <Text style={styles.salirBtnText}>{esAdmin ? 'Eliminar grupo' : 'Salir del grupo'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Menú: Invitar con la app / Agregar por nombre */}
      <Modal visible={menuAbierto} animationType="slide" transparent onRequestClose={() => setMenuAbierto(false)}>
        <Pressable style={styles.modalFondo} onPress={() => setMenuAbierto(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitulo}>Sumar a alguien</Text>
            <Pressable
              style={styles.menuOpcion}
              onPress={() => invitar.mutate(null)}
              disabled={invitar.isPending}>
              <Ionicons name="link-outline" size={20} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuOpcionTitulo}>Invitar con un link</Text>
                <Text style={styles.muted}>Para alguien que tiene la app. Se une y participa.</Text>
              </View>
              {invitar.isPending && <ActivityIndicator color={colors.purple} />}
            </Pressable>
            <Pressable
              style={styles.menuOpcion}
              onPress={() => {
                setMenuAbierto(false);
                setAddAbierto(true);
              }}>
              <Ionicons name="person-outline" size={20} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuOpcionTitulo}>Agregar por nombre</Text>
                <Text style={styles.muted}>Para alguien sin la app. Después lo podés invitar a que tome su lugar.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setMenuAbierto(false)}>
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <LinkInvitacionModal codigo={linkCodigo} onClose={() => setLinkCodigo(null)} colors={colors} />

      <AgregarPlaceholderModal
        visible={addAbierto}
        idGrupo={idGrupo}
        onClose={() => setAddAbierto(false)}
        colors={colors}
      />

      <CrearItemModal
        tipoForzado={crearTipo}
        editar={editarItem}
        idGrupo={idGrupo}
        miembros={miembros ?? []}
        onClose={() => {
          setCrearTipo(null);
          setEditarItem(null);
        }}
        colors={colors}
      />

      <InfoItemModal
        item={info}
        onEditar={abrirEditar}
        onBorrar={confirmarBorrar}
        onAdoptar={toggleAdopcion}
        onClose={() => setInfo(null)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

/** Recuadro de sección (Objetivos / Tareas), estilo tarjeta como en Hoy. */
function Bloque({ titulo, colors, children }: { titulo: string; colors: Tema; children: ReactNode }) {
  const styles = makeStyles(colors);
  return (
    <Card style={styles.bloque}>
      <Text style={styles.bloqueTitulo}>{titulo}</Text>
      {children}
    </Card>
  );
}

/** Sub-lista "Para vos" / "Del grupo" (no se muestra si está vacía). */
function SubLista({
  titulo,
  items,
  onMarcar,
  onInfo,
  colors,
}: {
  titulo: string;
  items: EsperadoGrupo[];
  onMarcar: (id: string, idMiembro: string | null, hecho: boolean) => void;
  onInfo: (i: EsperadoGrupo) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.subTitulo}>{titulo}</Text>
      {items.map((it) => (
        <ItemMarcable key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={onMarcar} onInfo={onInfo} colors={colors} />
      ))}
    </View>
  );
}

/** Fila de un ítem: emoji + nombre (toca → info) + a quién le toca + casillero para marcar. */
function ItemMarcable({
  it,
  onMarcar,
  onInfo,
  colors,
}: {
  it: EsperadoGrupo;
  onMarcar: (id: string, idMiembro: string | null, hecho: boolean) => void;
  onInfo: (i: EsperadoGrupo) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  function tocarCasilla() {
    if (!it.puedo_marcar) {
      Alert.alert('No podés marcar esto', 'Solo la persona asignada (o el admin) puede marcar este ítem.');
      return;
    }
    onMarcar(it.id_item, it.id_miembro_asignado, !it.hecho);
  }
  return (
    <View style={styles.itemMarcRow}>
      <Text style={styles.itemEmoji}>{it.icono ?? (it.tipo === 'OBJETIVO' ? '🎯' : '✔️')}</Text>
      <Pressable style={{ flex: 1 }} onPress={() => onInfo(it)}>
        <Text style={[styles.itemMarcTitulo, it.hecho && styles.itemHecho]}>{it.titulo}</Text>
        <Text style={styles.muted}>{it.asignado_nombre ?? 'Sin asignar'}</Text>
      </Pressable>
      <Pressable onPress={tocarCasilla} hitSlop={8}>
        <View
          style={[
            styles.casilla,
            it.hecho && styles.casillaOn,
            !it.puedo_marcar && !it.hecho && styles.casillaOff,
          ]}>
          {it.hecho && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </Pressable>
    </View>
  );
}

/** Sub-lista de objetivos "X veces por semana". */
function SubListaSemanal({
  titulo,
  items,
  onMarcar,
  onInfo,
  colors,
}: {
  titulo: string;
  items: SemanalGrupo[];
  onMarcar: (id: string, idMiembro: string | null, hecho: boolean) => void;
  onInfo: (i: SemanalGrupo) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.subTitulo}>{titulo}</Text>
      {items.map((it) => (
        <SemanalRow key={`${it.id_item}:${it.id_miembro_asignado ?? ""}`} it={it} onMarcar={onMarcar} onInfo={onInfo} colors={colors} />
      ))}
    </View>
  );
}

function SemanalRow({
  it,
  onMarcar,
  onInfo,
  colors,
}: {
  it: SemanalGrupo;
  onMarcar: (id: string, idMiembro: string | null, hecho: boolean) => void;
  onInfo: (i: SemanalGrupo) => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const completo = it.hechos >= it.veces_semana;
  function tocar() {
    if (!it.puedo_marcar) {
      Alert.alert('No podés marcar esto', 'Solo la persona asignada (o el admin) puede marcar este ítem.');
      return;
    }
    onMarcar(it.id_item, it.id_miembro_asignado, !it.hecho_fecha);
  }
  return (
    <View style={styles.itemMarcRow}>
      <Text style={styles.itemEmoji}>{it.icono ?? '📅'}</Text>
      <Pressable style={{ flex: 1 }} onPress={() => onInfo(it)}>
        <Text style={[styles.itemMarcTitulo, completo && styles.itemHecho]}>{it.titulo}</Text>
        <Text style={styles.muted}>
          {it.asignado_nombre ?? 'Sin asignar'} · {it.hechos}/{it.veces_semana} esta semana
        </Text>
      </Pressable>
      <Pressable onPress={tocar} hitSlop={8}>
        <View
          style={[
            styles.casilla,
            it.hecho_fecha && styles.casillaOn,
            !it.puedo_marcar && !it.hecho_fecha && styles.casillaOff,
          ]}>
          {it.hecho_fecha && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </Pressable>
    </View>
  );
}

/** Botón "＋ Objetivo" / "＋ Tarea". */
function BotonAgregar({ etiqueta, onPress, colors }: { etiqueta: string; onPress: () => void; colors: Tema }) {
  const styles = makeStyles(colors);
  return (
    <Pressable style={styles.masBtn} onPress={onPress}>
      <Ionicons name="add-circle" size={20} color={colors.purple} />
      <Text style={styles.masBtnText}>{etiqueta}</Text>
    </Pressable>
  );
}

/** Estado vacío de una sección: texto centrado + botón para crear. */
function VacioSeccion({
  texto,
  etiqueta,
  onPress,
  colors,
}: {
  texto: string;
  etiqueta: string;
  onPress: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
      <Text style={styles.muted}>{texto}</Text>
      <BotonAgregar etiqueta={etiqueta} onPress={onPress} colors={colors} />
    </View>
  );
}

/** Modal con la info de un ítem (al tocar el nombre). */
function InfoItemModal({
  item,
  onEditar,
  onBorrar,
  onAdoptar,
  onClose,
  colors,
}: {
  item: ItemInfo | null;
  onEditar: (id: string) => void;
  onBorrar: (i: ItemInfo) => void;
  onAdoptar: (id: string, adoptar: boolean) => void;
  onClose: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={item != null} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalFondo} onPress={onClose}>
        <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
          {item && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 34 }}>{item.icono ?? (item.tipo === 'OBJETIVO' ? '🎯' : '✔️')}</Text>
                <Text style={styles.modalTitulo}>{item.titulo}</Text>
              </View>
              <Text style={styles.infoLinea}>
                <Text style={styles.infoLabel}>Tipo: </Text>
                {item.tipo === 'OBJETIVO' ? 'Objetivo (se repite)' : 'Tarea (una vez)'}
              </Text>
              {item.descripcion ? <Text style={styles.infoLinea}>{item.descripcion}</Text> : null}
              {item.tipo === 'OBJETIVO' && (
                <Text style={styles.infoLinea}>
                  <Text style={styles.infoLabel}>Frecuencia: </Text>
                  {resumenItem(item)}
                  {item.fecha_fin ? ` · hasta ${fechaLarga(item.fecha_fin)}` : ''}
                </Text>
              )}
              {item.tipo === 'TAREA' && item.prioridad && (
                <Text style={styles.infoLinea}>
                  <Text style={styles.infoLabel}>Prioridad: </Text>
                  {item.prioridad.charAt(0) + item.prioridad.slice(1).toLowerCase()}
                </Text>
              )}
              {item.tipo === 'TAREA' && item.fecha_limite && (
                <Text style={styles.infoLinea}>
                  <Text style={styles.infoLabel}>Vence: </Text>
                  {fechaLarga(item.fecha_limite)}
                  {item.hora_limite ? ` · ${item.hora_limite}` : ''}
                </Text>
              )}
              <Text style={styles.infoLinea}>
                <Text style={styles.infoLabel}>Le toca a: </Text>
                {item.asignado_nombre ?? 'Sin asignar (cualquiera del grupo)'}
              </Text>

              {item.puedo_adoptar && (
                <View style={styles.adopcionFila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adopcionTitulo}>Agregar a mi pantalla de inicio</Text>
                    <Text style={styles.adopcionSub}>
                      Lo vas a ver en tu Hoy. Al cumplirlo suma al grupo, no a tu progreso personal.
                    </Text>
                  </View>
                  <Switch
                    value={item.adoptado}
                    onValueChange={(v) => onAdoptar(item.id_item, v)}
                    trackColor={{ true: colors.accent, false: colors.track }}
                    thumbColor="#fff"
                  />
                </View>
              )}

              {item.puedo_editar && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Pressable style={[styles.btnGhost, { flex: 1 }]} onPress={() => onBorrar(item)}>
                    <Text style={[styles.btnGhostText, { color: colors.red }]}>Borrar</Text>
                  </Pressable>
                  <Pressable style={[styles.btnPrimary, { flex: 1 }]} onPress={() => onEditar(item.id_item)}>
                    <Text style={styles.btnPrimaryText}>Editar</Text>
                  </Pressable>
                </View>
              )}
              <Pressable style={styles.btnGhost} onPress={onClose}>
                <Text style={styles.btnGhostText}>Cerrar</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CrearItemModal({
  tipoForzado,
  editar,
  idGrupo,
  miembros,
  onClose,
  colors,
}: {
  tipoForzado: 'TAREA' | 'OBJETIVO' | null;
  editar: ItemGrupoFull | null;
  idGrupo: string;
  miembros: MiembroGrupo[];
  onClose: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const esObjetivo = tipoForzado === 'OBJETIVO';
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [icono, setIcono] = useState<string | null>(null);
  // Objetivo
  const [frecuencia, setFrecuencia] = useState<'DIARIA' | 'DIAS' | 'SEMANAL'>('DIARIA');
  const [dias, setDias] = useState<number[]>([]);
  const [veces, setVeces] = useState(3);
  const [fechaInicio, setFechaInicio] = useState<string | null>(null);
  const [fechaFin, setFechaFin] = useState<string | null>(null);
  // Tarea
  const [prioridad, setPrioridad] = useState<'BAJA' | 'MEDIA' | 'ALTA'>('MEDIA');
  const [fechaLimite, setFechaLimite] = useState<string | null>(null);
  const [horaLimite, setHoraLimite] = useState<string | null>(null);
  // Común — asignación (varios miembros, opcionalmente por día)
  const [asignados, setAsignados] = useState<string[]>([]); // vacío = sin asignar
  const [porDia, setPorDia] = useState(false);
  const [diasMiembro, setDiasMiembro] = useState<Record<string, number[]>>({});
  const permitePorDia = esObjetivo && (frecuencia === 'DIARIA' || frecuencia === 'DIAS');
  // En "distinto por día", los días a repartir son SOLO los del objetivo (si es de días específicos).
  const diasDisponibles = frecuencia === 'DIAS' ? [...dias].sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7];

  // Al abrir: si es EDITAR, precargar con los datos del ítem; si es CREAR, dejar en blanco.
  useEffect(() => {
    if (tipoForzado == null) return; // modal cerrado
    if (editar) {
      setTitulo(editar.titulo);
      setDescripcion(editar.descripcion ?? '');
      setIcono(editar.icono);
      setFrecuencia(editar.frecuencia ?? 'DIARIA');
      setDias(editar.dias ?? []);
      setVeces(editar.veces_semana ?? 3);
      setFechaInicio(editar.fecha_inicio);
      setFechaFin(editar.fecha_fin);
      setPrioridad(editar.prioridad ?? 'MEDIA');
      setFechaLimite(editar.fecha_limite);
      setHoraLimite(editar.hora_limite);
      // Cargar las asignaciones actuales (varios miembros / por día).
      asignacionesItem(editar.id_item)
        .then((asigs) => {
          setAsignados(asigs.map((a) => a.id_miembro));
          setPorDia(asigs.some((a) => a.dias !== null));
          const map: Record<string, number[]> = {};
          for (const a of asigs) if (a.dias) map[a.id_miembro] = a.dias;
          setDiasMiembro(map);
        })
        .catch(() => {});
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoForzado, editar]);

  function reset() {
    setTitulo('');
    setDescripcion('');
    setIcono(null);
    setFrecuencia('DIARIA');
    setDias([]);
    setVeces(3);
    setFechaInicio(null);
    setFechaFin(null);
    setPrioridad('MEDIA');
    setFechaLimite(null);
    setHoraLimite(null);
    setAsignados([]);
    setPorDia(false);
    setDiasMiembro({});
  }

  const crear = useMutation({
    mutationFn: async () => {
      const item: NuevoItemGrupo = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        icono,
        tipo: esObjetivo ? 'OBJETIVO' : 'TAREA',
        frecuencia: esObjetivo ? frecuencia : null,
        dias: esObjetivo && frecuencia === 'DIAS' ? dias : null,
        veces_semana: esObjetivo && frecuencia === 'SEMANAL' ? veces : null,
        fecha_inicio: esObjetivo ? fechaInicio : null,
        fecha_fin: esObjetivo ? fechaFin : null,
        fecha_limite: !esObjetivo ? fechaLimite : null,
        hora_limite: !esObjetivo ? horaLimite : null,
        prioridad: !esObjetivo ? prioridad : null,
        id_miembro_asignado: null, // las asignaciones van aparte (set_asignaciones_item)
      };
      const idItem = editar ? (await editarItemGrupo(editar.id_item, item), editar.id_item) : await crearItemGrupo(idGrupo, item);
      // Asignaciones: vacío = sin asignar; con "por día" solo los que tienen al menos un día.
      const usaPorDia = permitePorDia && porDia;
      const asigs: AsignacionItem[] = asignados
        .map((m) => ({
          id_miembro: m,
          dias: usaPorDia ? (diasMiembro[m] ?? []).filter((d) => diasDisponibles.includes(d)) : null,
        }))
        .filter((a) => !usaPorDia || (a.dias?.length ?? 0) > 0);
      await setAsignacionesItem(idItem, asigs);
    },
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ['esperados-grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['semanales-grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['progreso-grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['progreso-miembros', idGrupo] });
      onClose();
    },
    onError: (e) => Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const diasOk = !esObjetivo || frecuencia !== 'DIAS' || dias.length > 0;

  return (
    <Modal visible={tipoForzado != null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalFondo}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitulo}>
              {editar ? (esObjetivo ? 'Editar objetivo' : 'Editar tarea') : esObjetivo ? 'Nuevo objetivo' : 'Nueva tarea'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ej: Lavar los platos"
              placeholderTextColor={colors.textMuted}
              value={titulo}
              onChangeText={setTitulo}
              autoFocus
            />

            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Descripción (opcional)"
              placeholderTextColor={colors.textMuted}
              value={descripcion}
              onChangeText={setDescripcion}
            />

            <Text style={styles.campoLabel}>Emoji (opcional)</Text>
            <View style={styles.chipsRow}>
              {EMOJIS_ITEM.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setIcono((prev) => (prev === e ? null : e))}
                  style={[styles.emojiChip, icono === e && styles.emojiChipOn]}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>

            {esObjetivo ? (
              <>
                <Text style={styles.campoLabel}>¿Cada cuándo?</Text>
                <View style={styles.chipsRow}>
                  <ChipSel texto="Todos los días" activo={frecuencia === 'DIARIA'} onPress={() => setFrecuencia('DIARIA')} colors={colors} />
                  <ChipSel texto="Días específicos" activo={frecuencia === 'DIAS'} onPress={() => setFrecuencia('DIAS')} colors={colors} />
                  <ChipSel texto="Veces por semana" activo={frecuencia === 'SEMANAL'} onPress={() => setFrecuencia('SEMANAL')} colors={colors} />
                </View>
                {frecuencia === 'DIAS' && (
                  <View style={styles.chipsRow}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <ChipSel
                        key={d}
                        texto={DIAS_CORTO[d]}
                        activo={dias.includes(d)}
                        onPress={() => setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                        colors={colors}
                      />
                    ))}
                  </View>
                )}
                {frecuencia === 'SEMANAL' && (
                  <View style={styles.stepperRow}>
                    <Pressable style={styles.stepperBtn} onPress={() => setVeces((v) => Math.max(1, v - 1))}>
                      <Ionicons name="remove" size={20} color={colors.purple} />
                    </Pressable>
                    <Text style={styles.stepperText}>{veces} {veces === 1 ? 'vez' : 'veces'} por semana</Text>
                    <Pressable style={styles.stepperBtn} onPress={() => setVeces((v) => Math.min(7, v + 1))}>
                      <Ionicons name="add" size={20} color={colors.purple} />
                    </Pressable>
                  </View>
                )}

                <View style={styles.fechasRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>Empieza</Text>
                    <DateTimeField
                      mode="date"
                      value={isoADate(fechaInicio)}
                      onChange={(d) => setFechaInicio(dateAISO(d))}
                      onClear={() => setFechaInicio(null)}
                      formato={(d) => fechaLarga(dateAISO(d))}
                      placeholder="Hoy"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>Termina</Text>
                    <DateTimeField
                      mode="date"
                      value={isoADate(fechaFin)}
                      onChange={(d) => setFechaFin(dateAISO(d))}
                      onClear={() => setFechaFin(null)}
                      formato={(d) => fechaLarga(dateAISO(d))}
                      placeholder="Nunca"
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.campoLabel}>Prioridad</Text>
                <View style={styles.chipsRow}>
                  <ChipSel texto="Baja" activo={prioridad === 'BAJA'} onPress={() => setPrioridad('BAJA')} colors={colors} />
                  <ChipSel texto="Media" activo={prioridad === 'MEDIA'} onPress={() => setPrioridad('MEDIA')} colors={colors} />
                  <ChipSel texto="Alta" activo={prioridad === 'ALTA'} onPress={() => setPrioridad('ALTA')} colors={colors} />
                </View>
                <View style={styles.fechasRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>Vence (fecha)</Text>
                    <DateTimeField
                      mode="date"
                      value={isoADate(fechaLimite)}
                      onChange={(d) => setFechaLimite(dateAISO(d))}
                      onClear={() => setFechaLimite(null)}
                      formato={(d) => fechaLarga(dateAISO(d))}
                      placeholder="Sin fecha"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>Hora</Text>
                    <DateTimeField
                      mode="time"
                      value={horaADate(horaLimite)}
                      onChange={(d) => setHoraLimite(dateAHora(d))}
                      onClear={() => setHoraLimite(null)}
                      formato={dateAHora}
                      placeholder="Sin hora"
                    />
                  </View>
                </View>
              </>
            )}

            <Text style={styles.campoLabel}>¿A quién?</Text>
            <View style={styles.chipsRow}>
              <ChipSel
                texto="Todos"
                activo={miembros.length > 0 && asignados.length === miembros.length}
                onPress={() => setAsignados(miembros.map((m) => m.id_miembro))}
                colors={colors}
              />
              <ChipSel
                texto="Sin asignar"
                activo={asignados.length === 0}
                onPress={() => {
                  setAsignados([]);
                  setPorDia(false);
                }}
                colors={colors}
              />
            </View>
            <View style={styles.chipsRow}>
              {miembros.map((m) => (
                <ChipSel
                  key={m.id_miembro}
                  texto={m.nombre}
                  activo={asignados.includes(m.id_miembro)}
                  onPress={() =>
                    setAsignados((prev) =>
                      prev.includes(m.id_miembro) ? prev.filter((x) => x !== m.id_miembro) : [...prev, m.id_miembro],
                    )
                  }
                  colors={colors}
                />
              ))}
            </View>

            {permitePorDia && asignados.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <Text style={[styles.campoLabel, { marginTop: 0 }]}>Distinto por día</Text>
                  <Switch
                    value={porDia}
                    onValueChange={setPorDia}
                    trackColor={{ true: colors.accent, false: colors.track }}
                    thumbColor="#fff"
                  />
                </View>
                {porDia &&
                  asignados.map((mid) => (
                    <View key={mid} style={{ marginTop: 6 }}>
                      <Text style={styles.muted}>{miembros.find((m) => m.id_miembro === mid)?.nombre ?? 'Miembro'}</Text>
                      <View style={styles.chipsRow}>
                        {diasDisponibles.map((d) => (
                          <ChipSel
                            key={d}
                            texto={DIAS_CORTO[d]}
                            activo={(diasMiembro[mid] ?? []).includes(d)}
                            onPress={() =>
                              setDiasMiembro((prev) => {
                                const cur = prev[mid] ?? [];
                                const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
                                return { ...prev, [mid]: next };
                              })
                            }
                            colors={colors}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.btnGhost, { flex: 1 }]} onPress={onClose} disabled={crear.isPending}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, { flex: 1 }, (!titulo.trim() || !diasOk || crear.isPending) && { opacity: 0.5 }]}
                onPress={() => crear.mutate()}
                disabled={!titulo.trim() || !diasOk || crear.isPending}>
                {crear.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>{editar ? 'Guardar' : 'Crear'}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChipSel({
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
    <Pressable style={[styles.chipSel, activo && styles.chipSelOn]} onPress={onPress}>
      <Text style={[styles.chipSelText, activo && styles.chipSelTextOn]}>{texto}</Text>
    </Pressable>
  );
}

function LinkInvitacionModal({
  codigo,
  onClose,
  colors,
}: {
  codigo: string | null;
  onClose: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const PLAY = 'https://play.google.com/store/apps/details?id=com.sofiasoler.drakostone';

  async function compartir() {
    if (!codigo) return;
    try {
      await Share.share({
        message:
          `¡Te invito a mi grupo en Drakostone! 🐉\n\n` +
          `Abrí la app Drakostone → pestaña Grupos → "Unirme a un grupo con un código" y poné este código:\n\n` +
          `${codigo}\n\n` +
          `¿Todavía no tenés Drakostone? Descargala acá:\n${PLAY}`,
      });
    } catch {
      /* el usuario canceló */
    }
  }

  return (
    <Modal visible={codigo != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalFondo}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.modalTitulo}>Invitación lista 🎉</Text>
          <Text style={styles.muted}>
            Pasale este código a la persona. En la app va a Grupos → “Unirme a un grupo con un código” y lo
            ingresa. Con el botón de abajo compartís el mensaje ya armado (con el link de descarga).
          </Text>
          <View style={styles.codigoBox}>
            <Text style={styles.codigoText}>{codigo}</Text>
          </View>
          <Pressable style={styles.btnPrimary} onPress={compartir}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>Compartir invitación</Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={onClose}>
            <Text style={styles.btnGhostText}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function TabBtn({
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
    <Pressable style={[styles.tabBtn, activo && styles.tabBtnOn]} onPress={onPress}>
      <Text
        style={[styles.tabBtnText, activo && styles.tabBtnTextOn]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}>
        {texto}
      </Text>
    </Pressable>
  );
}

function MiembroProgresoRow({ m, colors }: { m: ProgresoMiembro; colors: Tema }) {
  const styles = makeStyles(colors);
  const inicial = (m.nombre[0] ?? '?').toUpperCase();
  return (
    <Card style={styles.progMiembroRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{inicial}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.miembroNombre} numberOfLines={1}>
            {m.nombre}
            {m.es_yo ? ' (vos)' : ''}
            {m.es_placeholder ? ' · sin app' : ''}
          </Text>
          <Text style={styles.progMiembroPct}>{m.pct}%</Text>
        </View>
        <ProgressBar progress={m.pct / 100} />
        <Text style={styles.muted}>
          {m.esperados > 0 ? `${m.hechos} de ${m.esperados} cumplidos` : 'Nada asignado en este período'}
        </Text>
      </View>
    </Card>
  );
}

function MiembroRow({
  m,
  esAdmin,
  invitando,
  onInvitar,
  onSacar,
  onHacerAdmin,
  colors,
}: {
  m: MiembroGrupo;
  esAdmin: boolean;
  invitando: boolean;
  onInvitar: () => void;
  onSacar: () => void;
  onHacerAdmin: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const inicial = (m.nombre[0] ?? '?').toUpperCase();
  return (
    <Card style={styles.miembroRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{inicial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.miembroNombre}>
          {m.nombre}
          {m.es_yo ? ' (vos)' : ''}
        </Text>
        <Text style={styles.muted}>
          {m.rol === 'ADMIN' ? 'Admin' : 'Miembro'}
          {m.es_placeholder ? ' · sin app todavía' : ''}
        </Text>
      </View>
      <View style={styles.miembroAcciones}>
        {/* Para un placeholder, el admin puede generar un link que le haga TOMAR este lugar. */}
        {esAdmin && m.es_placeholder && (
          <Pressable style={styles.invitarBtn} onPress={onInvitar} disabled={invitando} hitSlop={6}>
            {invitando ? (
              <ActivityIndicator size="small" color={colors.purple} />
            ) : (
              <Text style={styles.invitarBtnText}>Invitar</Text>
            )}
          </Pressable>
        )}
        {/* Pasar el rol de admin a un miembro real (no a un placeholder). */}
        {esAdmin && m.rol !== 'ADMIN' && !m.es_placeholder && !m.es_yo && (
          <Pressable onPress={onHacerAdmin} hitSlop={8}>
            <Ionicons name="star-outline" size={18} color={colors.orange} />
          </Pressable>
        )}
        {esAdmin && m.rol !== 'ADMIN' && (
          <Pressable onPress={onSacar} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.red} />
          </Pressable>
        )}
        {m.rol === 'ADMIN' && <Ionicons name="star" size={16} color={colors.orange} />}
      </View>
    </Card>
  );
}

function AgregarPlaceholderModal({
  visible,
  idGrupo,
  onClose,
  colors,
}: {
  visible: boolean;
  idGrupo: string;
  onClose: () => void;
  colors: Tema;
}) {
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');

  const agregar = useMutation({
    mutationFn: () => agregarPlaceholder(idGrupo, nombre.trim()),
    onSuccess: () => {
      setNombre('');
      qc.invalidateQueries({ queryKey: ['miembros', idGrupo] });
      qc.invalidateQueries({ queryKey: ['grupo', idGrupo] });
      qc.invalidateQueries({ queryKey: ['mis-grupos'] });
      onClose();
    },
    onError: (e) => Alert.alert('No se pudo agregar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalFondo}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.modalTitulo}>Agregar persona</Text>
          <Text style={styles.muted}>
            Sumá a alguien por su nombre. Vos vas a marcar sus tareas hasta que se instale la app y tome su
            lugar.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre (ej: Maria)"
            placeholderTextColor={colors.textMuted}
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable style={[styles.btnGhost, { flex: 1 }]} onPress={onClose} disabled={agregar.isPending}>
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, { flex: 1 }, (!nombre.trim() || agregar.isPending) && { opacity: 0.5 }]}
              onPress={() => agregar.mutate()}
              disabled={!nombre.trim() || agregar.isPending}>
              {agregar.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Agregar</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      paddingBottom: 6,
    },
    tituloWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
    tituloIcono: { fontSize: 20 },
    titulo: { fontSize: 18, fontWeight: '800', color: colors.text, maxWidth: '80%' },
    tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: 8 },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    tabBtnOn: { backgroundColor: colors.purple, borderColor: colors.purple },
    tabBtnText: { fontWeight: '700', color: colors.text, fontSize: 13 },
    tabBtnTextOn: { color: '#fff' },
    errorBox: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.redBorder,
      backgroundColor: colors.red + '14',
      borderRadius: 12,
      padding: 14,
    },
    errorText: { color: colors.red, fontWeight: '600', fontSize: 13, textAlign: 'center' },
    scroll: { padding: spacing.lg, paddingTop: 4, paddingBottom: 40 },
    proximamente: { alignItems: 'center', paddingVertical: 50, gap: 12 },
    proxText: { fontSize: 14.5, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.purple,
      borderRadius: 12,
      paddingVertical: 11,
    },
    addBtnText: { color: colors.purple, fontWeight: '800', fontSize: 14 },
    miembroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    recompensasCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.purple,
      padding: 14,
      marginBottom: 12,
    },
    recompensasTitulo: { fontSize: 15.5, fontWeight: '800', color: colors.text },
    recompensasSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    rangoRow: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 999,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.divider,
      marginBottom: 2,
    },
    rangoBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
    rangoBtnOn: { backgroundColor: colors.purple },
    rangoBtnText: { fontWeight: '700', color: colors.text, fontSize: 13 },
    rangoBtnTextOn: { color: '#fff' },
    progGrupoCard: { gap: 8 },
    progGrupoTitulo: { fontSize: 15.5, fontWeight: '800', color: colors.text },
    progGrupoPct: { fontSize: 18, fontWeight: '900', color: colors.purple },
    progGrupoSub: { fontSize: 12.5, color: colors.textMuted },
    progMiembroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    progMiembroPct: { fontSize: 15, fontWeight: '900', color: colors.purple },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.purple100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 17, fontWeight: '800', color: colors.purple700 },
    miembroNombre: { fontSize: 15.5, fontWeight: '700', color: colors.text },
    muted: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
    nota: { fontSize: 12.5, color: colors.textMuted, marginTop: 18, lineHeight: 18 },
    modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: spacing.lg,
      paddingBottom: 32,
      gap: 10,
      maxHeight: '88%',
    },
    modalTitulo: { fontSize: 19, fontWeight: '800', color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    btnGhost: {
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 999,
      paddingVertical: 13,
    },
    btnGhostText: { color: colors.text, fontWeight: '700', fontSize: 14 },
    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 13,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    menuOpcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    menuOpcionTitulo: { fontSize: 15, fontWeight: '700', color: colors.text },
    codigoBox: {
      alignItems: 'center',
      backgroundColor: colors.purple100,
      borderRadius: 12,
      paddingVertical: 16,
      marginVertical: 4,
    },
    codigoText: { fontSize: 26, fontWeight: '800', color: colors.purple700, letterSpacing: 4 },
    invitarBtn: {
      borderWidth: 1,
      borderColor: colors.purple,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    invitarBtnText: { color: colors.purple, fontWeight: '800', fontSize: 12.5 },
    miembroAcciones: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    salirBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.redBorder,
    },
    salirBtnText: { color: colors.red, fontWeight: '800', fontSize: 14 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemIcono: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.purple100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemTitulo: { fontSize: 15.5, fontWeight: '700', color: colors.text },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 },
    chipSel: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipSelOn: { backgroundColor: colors.purple, borderColor: colors.purple },
    chipSelText: { fontSize: 13, color: colors.text, fontWeight: '600' },
    chipSelTextOn: { color: '#fff' },
    campoLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '700', marginTop: 10 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 },
    stepperBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.purple,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperText: { fontSize: 15, fontWeight: '700', color: colors.text },
    fechasRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
    emojiChip: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiChipOn: { borderColor: colors.purple, backgroundColor: colors.purple100 },
    navDia: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      marginBottom: 2,
    },
    navDiaText: { fontSize: 15, fontWeight: '800', color: colors.text },
    volverHoy: { color: colors.purple, fontWeight: '700', fontSize: 13 },
    bloque: { gap: 10 },
    bloqueTitulo: { fontSize: 16, fontWeight: '800', color: colors.text },
    seccionHeader: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8, marginLeft: 2 },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rankPos: { fontSize: 14, fontWeight: '900', color: colors.textMuted, width: 20 },
    rankNombre: { flex: 1, fontSize: 14.5, color: colors.text },
    rankPts: { fontSize: 14, fontWeight: '800', color: colors.text },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardPurple,
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    heroTitulo: { fontSize: 13.5, fontWeight: '700', color: colors.textMuted },
    heroPct: { fontSize: 30, fontWeight: '800', color: colors.purple700, marginBottom: 4 },
    heroSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 6 },
    masBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
    masBtnText: { color: colors.purple, fontWeight: '800', fontSize: 14 },
    subTitulo: { fontSize: 12.5, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    itemMarcRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
    itemMarcTitulo: { fontSize: 15, fontWeight: '600', color: colors.text },
    itemHecho: { textDecorationLine: 'line-through', color: colors.textMuted },
    casilla: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.track,
      alignItems: 'center',
      justifyContent: 'center',
    },
    casillaOn: { backgroundColor: colors.green, borderColor: colors.green },
    casillaOff: { opacity: 0.4 },
    infoLinea: { fontSize: 14.5, color: colors.text, lineHeight: 22 },
    infoLabel: { fontWeight: '800', color: colors.textMuted },
    adopcionFila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.track,
      backgroundColor: colors.surface,
    },
    adopcionTitulo: { fontSize: 14.5, fontWeight: '800', color: colors.text },
    adopcionSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  });
