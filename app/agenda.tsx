import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrganizarSemanaModal } from '@/components/OrganizarSemanaModal';
import { RazonOmisionModal } from '@/components/RazonOmisionModal';
import { RevisarCalendarioModal } from '@/components/RevisarCalendarioModal';
import { HorarioDiaModal } from '@/components/HorarioDiaModal';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { HojaAcciones, type OpcionAccion } from '@/components/HojaAcciones';
import { VistaDiaAgenda } from '@/components/VistaDiaAgenda';
import { VistaMesAgenda } from '@/components/VistaMesAgenda';
import { spacing, type Tema } from '@/constants/theme';
import {
  agendaEnRango,
  aplicarCambiosCalendario,
  type CambioCalendario,
  conectarGoogleCalendar,
  conectarTelefono,
  dejarDeHacerObjetivo,
  detectarCambiosCalendario,
  eliminarObjetivo,
  eventosDeLaSemana,
  googleConectado,
  googleConfigurado,
  type ItemAgenda,
  cambiarHorarioDiaYReflejar,
  omitirYReflejar,
  sincronizarObjetivosSinEspejo,
  telefonoConectado,
} from '@/lib/data';
import { fechaLarga, fechaLargaConDia, hoyISO, inicioSemanaISO, nombreMes, sumarDiasISO } from '@/logic/fecha';
import { horaHHMM, nombreDia, rangoHorario } from '@/logic/agenda';

export default function AgendaScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const [iaAbierta, setIaAbierta] = useState(false);
  const [lunesISO, setLunesISO] = useState(() => inicioSemanaISO(hoyISO()));

  const semanaActual = lunesISO === inicioSemanaISO(hoyISO());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agenda-semana', lunesISO],
    queryFn: () => eventosDeLaSemana(false, lunesISO),
  });

  // Estado de conexión de cada fuente (para mostrar u ocultar la tarjeta de "conectar").
  const { data: telefonoOn } = useQuery({
    queryKey: ['tel-cal-conectado'],
    queryFn: telefonoConectado,
  });
  const googleDisponible = googleConfigurado();
  const { data: googleOn } = useQuery({
    queryKey: ['google-cal-conectado'],
    queryFn: googleConectado,
    enabled: googleDisponible,
  });

  // "Elegir ninguno": el usuario decidió no conectar calendarios → se ocultan las opciones.
  const [descartado, setDescartado] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_DESCARTADO)
      .then((v) => setDescartado(v === '1'))
      .catch(() => {});
  }, []);
  function elegirNinguno() {
    setDescartado(true);
    AsyncStorage.setItem(CLAVE_DESCARTADO, '1').catch(() => {});
  }

  const conectarTel = useMutation({
    // Al conectar, re-sincronizamos los objetivos con horario que quedaron sin evento (1.c).
    mutationFn: async () => {
      const ok = await conectarTelefono();
      if (ok) await sincronizarObjetivosSinEspejo().catch(() => {});
      return ok;
    },
    onSuccess: (ok) => {
      queryClient.invalidateQueries({ queryKey: ['tel-cal-conectado'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-semana'] });
      if (!ok)
        Alert.alert(
          'Permiso denegado',
          'Activá el acceso al calendario en los ajustes del teléfono para ver tus eventos.',
        );
    },
  });
  const conectarGoogle = useMutation({
    mutationFn: async () => {
      const ok = await conectarGoogleCalendar();
      if (ok) await sincronizarObjetivosSinEspejo().catch(() => {});
      return ok;
    },
    onSuccess: (ok) => {
      queryClient.invalidateQueries({ queryKey: ['google-cal-conectado'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-semana'] });
      if (!ok)
        Alert.alert(
          'No se pudo conectar',
          'No pudimos conectar con Google Calendar. Probá de nuevo.',
        );
    },
  });

  // Las opciones de conectar aparecen SOLO si no hay ninguna fuente conectada y no elegiste "ninguno".
  const algunoConectado = !!telefonoOn || !!googleOn;
  const mostrarConectar = !algunoConectado && !descartado;

  // Vista: Lista (actual) · Día (grilla de horas) · Mes (resumen con puntitos). Se recuerda.
  const [vista, setVista] = useState<'lista' | 'dia' | 'mes'>('lista');
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_VISTA)
      .then((v) => {
        if (v === 'dia' || v === 'mes' || v === 'lista') setVista(v);
      })
      .catch(() => {});
  }, []);
  function cambiarVista(v: 'lista' | 'dia' | 'mes') {
    setVista(v);
    AsyncStorage.setItem(CLAVE_VISTA, v).catch(() => {});
  }

  // Vista Día: una jornada con grilla de horas.
  const [diaSel, setDiaSel] = useState(() => hoyISO());
  const { data: diaDias, isLoading: diaCargando } = useQuery({
    queryKey: ['agenda-dia', diaSel],
    queryFn: () => agendaEnRango(diaSel, 1),
    enabled: vista === 'dia',
  });
  const itemsDia = diaDias?.[0]?.items ?? [];

  // Vista Mes: grilla de 6 semanas (empieza el lunes que cae en/antes del 1°). 2.b: no pasa del mes actual.
  const [mesSel, setMesSel] = useState(() => hoyISO().slice(0, 7));
  const mesActual = hoyISO().slice(0, 7);
  const puedeAvanzarMes = mesSel < mesActual;
  const { data: mesDias, isLoading: mesCargando } = useQuery({
    queryKey: ['agenda-mes', mesSel],
    queryFn: () => agendaEnRango(inicioSemanaISO(`${mesSel}-01`), 42),
    enabled: vista === 'mes',
  });
  function moverMes(delta: number) {
    const [y, m] = mesSel.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nuevo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (delta > 0 && nuevo > mesActual) return; // no pasar del mes actual
    setMesSel(nuevo);
  }

  // ⚠️ La sincronización automática calendario→app (1.a/1.b) quedó DESACTIVADA: modificaba los
  // objetivos al leer el calendario (borrar/editar en Google) y corrompía datos + crasheaba. Se
  // rediseñará más segura (manual + con vista previa). La dirección app→calendario sigue activa.
  const totalItems = data?.dias.reduce((n, d) => n + d.items.length, 0) ?? 0;
  const finSemana = sumarDiasISO(lunesISO, 6);

  // Al borrar/quitar/editar un objetivo, refrescar TODAS las vistas de la agenda (incluidas Día y Mes).
  const invalidarTodo = () => {
    for (const k of [
      ['agenda-semana'],
      ['agenda-dia'],
      ['agenda-mes'],
      ['esperados-hoy'],
      ['semanales-hoy'],
      ['objetivos'],
      ['progreso-dias'],
      ['progreso-mes'],
      ['detalle-dia'],
    ])
      queryClient.invalidateQueries({ queryKey: k });
  };
  const quitarDia = useMutation({
    mutationFn: ({ id, fecha, razon }: { id: string; fecha: string; razon?: string | null }) =>
      omitirYReflejar(id, fecha, true, razon),
    onSuccess: invalidarTodo,
  });
  // Objetivo elegido para "Quitar de este día" → abre el modal de razón.
  const [razonTarget, setRazonTarget] = useState<{ id: string; fecha: string; titulo: string } | null>(null);
  const borrarObjetivo = useMutation({
    mutationFn: (id: string) => eliminarObjetivo(id),
    onSuccess: invalidarTodo,
  });
  const dejarDeHacer = useMutation({
    mutationFn: (id: string) => dejarDeHacerObjetivo(id),
    onSuccess: invalidarTodo,
  });

  // Revisar cambios del calendario (doble vía SEGURA: detecta → te muestra → confirmás → aplica).
  const [revisarAbierto, setRevisarAbierto] = useState(false);
  const [cambiosCal, setCambiosCal] = useState<CambioCalendario[]>([]);
  const revisar = useMutation({
    mutationFn: () => detectarCambiosCalendario(),
    onSuccess: (cambios) => {
      if (cambios.length === 0) {
        Alert.alert('Sin cambios', 'No encontramos cambios nuevos en tu calendario para aplicar.');
        return;
      }
      setCambiosCal(cambios);
      setRevisarAbierto(true);
    },
    onError: () => Alert.alert('No se pudo revisar', 'No pudimos leer tu calendario. Probá de nuevo.'),
  });
  const aplicarCambios = useMutation({
    mutationFn: (sel: CambioCalendario[]) => aplicarCambiosCalendario(sel),
    onSuccess: () => {
      setRevisarAbierto(false);
      invalidarTodo();
      Alert.alert('¡Listo! 🐉', 'Apliqué los cambios que elegiste.');
    },
    onError: () => Alert.alert('Error', 'No pudimos aplicar los cambios. Probá de nuevo.'),
  });

  // Horario "solo por este día" (2.d): override de hora para una fecha puntual, sin tocar la rutina.
  const [horarioTarget, setHorarioTarget] = useState<{ id: string; fecha: string; titulo: string; hi: string; hf: string } | null>(null);
  const guardarHorarioDia = useMutation({
    mutationFn: ({ id, fecha, hi, hf }: { id: string; fecha: string; hi: string | null; hf: string | null }) =>
      cambiarHorarioDiaYReflejar(id, fecha, hi, hf),
    onSuccess: () => {
      setHorarioTarget(null);
      for (const k of [['agenda-semana'], ['agenda-dia'], ['agenda-mes']])
        queryClient.invalidateQueries({ queryKey: k });
    },
    onError: () => Alert.alert('Error', 'No se pudo guardar el horario. Probá de nuevo.'),
  });

  // Menú de acciones propio (hoja desde abajo) — Android solo muestra 3 botones en un Alert.
  const [menu, setMenu] = useState<{ titulo: string; opciones: OpcionAccion[] } | null>(null);

  // Submenú de eliminar: NUNCA borra el historial por defecto → dos opciones.
  function menuEliminar(id: string, titulo: string) {
    setMenu({
      titulo: `Eliminar "${titulo}"`,
      opciones: [
        {
          texto: 'Dejar de hacerlo (de hoy en adelante)',
          onPress: () => {
            setMenu(null);
            dejarDeHacer.mutate(id);
          },
        },
        {
          texto: 'Eliminar todo (incluido el historial)',
          destructivo: true,
          onPress: () => {
            setMenu(null);
            Alert.alert(
              '¿Seguro?',
              'Se borra el objetivo y TODO su historial de cumplimiento. No se puede deshacer.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar todo', style: 'destructive', onPress: () => borrarObjetivo.mutate(id) },
              ],
            );
          },
        },
      ],
    });
  }

  // Menú al tocar un objetivo: ver info, editar, (horario solo este día), quitar día, o eliminar.
  function menuObjetivo(id: string, fecha: string, titulo: string, item?: ItemAgenda) {
    const opciones: OpcionAccion[] = [
      {
        texto: 'Ver información',
        onPress: () => {
          setMenu(null);
          router.push(`/objetivo/info/${id}?fecha=${fecha}`);
        },
      },
      {
        texto: 'Editar (horario, color…)',
        onPress: () => {
          setMenu(null);
          router.push(`/objetivo/${id}`);
        },
      },
    ];
    // Solo para objetivos-evento con horario (no tareas ni de todo el día): cambiar la hora SOLO ese día.
    if (item && item.esApp && !item.esTarea && !item.todoElDia) {
      opciones.push({
        texto: 'Cambiar horario solo este día',
        onPress: () => {
          setMenu(null);
          setHorarioTarget({ id, fecha, titulo, hi: horaHHMM(item.inicio), hf: horaHHMM(item.fin) });
        },
      });
    }
    opciones.push({
      texto: 'Quitar de este día',
      onPress: () => {
        setMenu(null);
        setRazonTarget({ id, fecha, titulo });
      },
    });
    opciones.push({ texto: 'Eliminar el objetivo…', destructivo: true, onPress: () => menuEliminar(id, titulo) });
    setMenu({ titulo, opciones });
  }

  // Tocar un ítem (en la vista Día): objetivo propio → menú; tarea → su info; evento externo → nada.
  function abrirItem(e: ItemAgenda, fechaISO: string) {
    if (e.refObjetivoId && !e.esTarea) return menuObjetivo(e.refObjetivoId, fechaISO, e.titulo, e);
    if (e.refTareaId) return router.push(`/tarea/info/${e.refTareaId}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.h1}>Mi semana</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Selector de vista: Lista · Día · Mes */}
      <View style={styles.vistaSelector}>
        {(['lista', 'dia', 'mes'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => cambiarVista(v)}
            style={[styles.vistaBtn, vista === v && styles.vistaBtnAct]}>
            <Text style={[styles.vistaBtnText, vista === v && styles.vistaBtnTextAct]}>
              {v === 'lista' ? 'Semana' : v === 'dia' ? 'Día' : 'Mes'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Navegación (según la vista) */}
      {vista === 'lista' && (
        <View style={styles.semanaNav}>
          <Pressable onPress={() => setLunesISO((l) => sumarDiasISO(l, -7))} hitSlop={8} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.purple} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.semanaRango}>
              {Number(lunesISO.slice(8))} – {Number(finSemana.slice(8))} de {mesDe(finSemana)}
            </Text>
            {!semanaActual && (
              <Pressable onPress={() => setLunesISO(inicioSemanaISO(hoyISO()))} hitSlop={6}>
                <Text style={styles.volverHoy}>Volver a esta semana</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => setLunesISO((l) => sumarDiasISO(l, 7))} hitSlop={8} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.purple} />
          </Pressable>
        </View>
      )}
      {vista === 'dia' && (
        <View style={styles.semanaNav}>
          <Pressable onPress={() => setDiaSel((d) => sumarDiasISO(d, -1))} hitSlop={8} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.purple} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.semanaRango}>{cap(fechaLargaConDia(diaSel))}</Text>
            {diaSel !== hoyISO() && (
              <Pressable onPress={() => setDiaSel(hoyISO())} hitSlop={6}>
                <Text style={styles.volverHoy}>Volver a hoy</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => setDiaSel((d) => sumarDiasISO(d, 1))} hitSlop={8} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.purple} />
          </Pressable>
        </View>
      )}
      {vista === 'mes' && (
        <View style={styles.semanaNav}>
          <Pressable onPress={() => moverMes(-1)} hitSlop={8} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.purple} />
          </Pressable>
          <Text style={styles.semanaRango}>
            {cap(nombreMes(`${mesSel}-01`))} {mesSel.slice(0, 4)}
          </Text>
          <Pressable
            onPress={() => moverMes(1)}
            hitSlop={8}
            disabled={!puedeAvanzarMes}
            style={[styles.navBtn, !puedeAvanzarMes && { opacity: 0.35 }]}>
            <Ionicons name="chevron-forward" size={20} color={colors.purple} />
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.iaBtn} onPress={() => setIaAbierta(true)}>
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={styles.iaBtnText}>Organizá mi semana con IA</Text>
        </Pressable>

        {/* Doble vía SEGURA (link chico): trae a la app los cambios que hiciste en el calendario. */}
        {algunoConectado && (
          <Pressable
            style={styles.revisarBtn}
            onPress={() => revisar.mutate()}
            disabled={revisar.isPending}
            hitSlop={8}>
            <Ionicons name="sync-outline" size={13} color={colors.purple} />
            <Text style={styles.revisarBtnText}>
              {revisar.isPending ? 'Actualizando…' : 'Actualizar cambios del calendario'}
            </Text>
          </Pressable>
        )}

        {vista === 'lista' && isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}

        {vista === 'lista' && isError && (
          <EstadoMensaje
            titulo="No pudimos leer tu calendario"
            subtitulo="Intentá de nuevo en un momento."
            onReintentar={() => refetch()}
          />
        )}

        {/* Conectar calendarios: SOLO si no hay ninguno conectado y no elegiste "ninguno".
            Una vez que conectás uno (o elegís ninguno), esto desaparece; se gestiona en Perfil. */}
        {mostrarConectar && (
          <Card style={{ gap: 12 }}>
            <Text style={styles.h2}>Conectá tu calendario</Text>
            <Text style={styles.muted}>
              Para ver tus eventos acá y que la IA no superponga lo que agenda. Elegí una fuente
              (después podés cambiarla desde Perfil):
            </Text>

            <View style={styles.calRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.calNombre}>📱 Calendario del teléfono</Text>
              </View>
              <Pressable
                style={styles.calBtn}
                onPress={() => conectarTel.mutate()}
                disabled={conectarTel.isPending}>
                <Text style={styles.calBtnText}>{conectarTel.isPending ? '…' : 'Conectar'}</Text>
              </Pressable>
            </View>

            {googleDisponible && (
              <View style={styles.calRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calNombre}>📅 Google Calendar</Text>
                </View>
                <Pressable
                  style={styles.calBtn}
                  onPress={() => conectarGoogle.mutate()}
                  disabled={conectarGoogle.isPending}>
                  <Text style={styles.calBtnText}>{conectarGoogle.isPending ? '…' : 'Conectar'}</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={elegirNinguno} hitSlop={6} style={{ alignSelf: 'center' }}>
              <Text style={styles.ningunoLink}>Usar solo Drakostone (sin calendario)</Text>
            </Pressable>
          </Card>
        )}

        {/* ── Vista Día ── */}
        {vista === 'dia' && (
          diaCargando ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : itemsDia.length === 0 ? (
            <EstadoMensaje conDragon titulo="Día despejado" subtitulo="No hay nada agendado este día." />
          ) : (
            <VistaDiaAgenda items={itemsDia} colors={colors} onTapItem={(e) => abrirItem(e, diaSel)} />
          )
        )}

        {/* ── Vista Mes ── */}
        {vista === 'mes' && (
          mesCargando ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : (
            <VistaMesAgenda
              mesISO={mesSel}
              dias={mesDias ?? []}
              colors={colors}
              onTapDia={(f) => {
                setDiaSel(f);
                cambiarVista('dia');
              }}
            />
          )
        )}

        {/* ── Vista Lista ── */}
        {vista === 'lista' && !isLoading && !isError && totalItems === 0 && (
          <EstadoMensaje
            conDragon
            titulo="Semana despejada"
            subtitulo="No hay nada agendado esta semana."
          />
        )}

        {vista === 'lista' &&
          !isLoading &&
          totalItems > 0 &&
          data!.dias.map((dia) => (
            <View key={dia.fechaISO} style={styles.diaBloque}>
              <View style={styles.diaHeader}>
                <Text style={[styles.diaNombre, dia.esHoy && styles.diaHoy]}>
                  {dia.esHoy ? 'Hoy' : nombreDia(dia.fechaISO)}
                </Text>
                <Text style={styles.diaFecha}>{fechaLarga(dia.fechaISO)}</Text>
              </View>

              {dia.items.length === 0 ? (
                <Text style={styles.sinEventos}>Sin nada agendado</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {dia.items.map((e) => {
                    const ref: Href | null = e.refTareaId
                      ? `/tarea/info/${e.refTareaId}`
                      : e.refObjetivoId
                        ? `/objetivo/info/${e.refObjetivoId}`
                        : null;
                    const subtitulo = e.esTarea
                      ? e.todoElDia
                        ? 'Vence este día'
                        : `Vence ${horaHHMM(e.inicio)}`
                      : `${rangoHorario(e)}${e.ubicacion ? ` · ${e.ubicacion}` : ''}`;
                    const contenido = (
                      <>
                        <View style={[styles.puntito, { backgroundColor: e.color ?? colors.purple }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.tituloRow}>
                            <Text style={styles.eventoTitulo}>{e.titulo}</Text>
                            {e.esTarea ? (
                              <View style={styles.tag}>
                                <Text style={styles.tagText}>📌 tarea</Text>
                              </View>
                            ) : e.esApp ? (
                              <View style={styles.tag}>
                                <Text style={styles.tagText}>🐉 objetivo</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.muted}>{subtitulo}</Text>
                        </View>
                        {ref && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                      </>
                    );
                    // Objetivo propio → menú (info / quitar este día / borrar). Tarea → su info.
                    const onPress =
                      e.refObjetivoId && !e.esTarea
                        ? () => menuObjetivo(e.refObjetivoId!, dia.fechaISO, e.titulo, e)
                        : ref
                          ? () => router.push(ref)
                          : null;
                    return onPress ? (
                      <Pressable key={e.id} onPress={onPress}>
                        <Card style={styles.eventoRow}>{contenido}</Card>
                      </Pressable>
                    ) : (
                      <Card key={e.id} style={styles.eventoRow}>
                        {contenido}
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
      </ScrollView>

      <OrganizarSemanaModal visible={iaAbierta} onClose={() => setIaAbierta(false)} />

      <RazonOmisionModal
        visible={razonTarget != null}
        nombre={razonTarget?.titulo}
        onCancelar={() => setRazonTarget(null)}
        onConfirmar={(razon) => {
          if (razonTarget) quitarDia.mutate({ id: razonTarget.id, fecha: razonTarget.fecha, razon });
          setRazonTarget(null);
        }}
      />

      <HojaAcciones
        visible={menu != null}
        titulo={menu?.titulo}
        opciones={menu?.opciones ?? []}
        colors={colors}
        onCerrar={() => setMenu(null)}
      />

      <RevisarCalendarioModal
        visible={revisarAbierto}
        cambios={cambiosCal}
        colors={colors}
        aplicando={aplicarCambios.isPending}
        onCancelar={() => setRevisarAbierto(false)}
        onAplicar={(sel) => aplicarCambios.mutate(sel)}
      />

      <HorarioDiaModal
        visible={horarioTarget != null}
        titulo={horarioTarget?.titulo}
        fechaLabel={horarioTarget ? fechaLargaConDia(horarioTarget.fecha) : undefined}
        horaInicio={horarioTarget?.hi}
        horaFin={horarioTarget?.hf}
        colors={colors}
        guardando={guardarHorarioDia.isPending}
        onCancelar={() => setHorarioTarget(null)}
        onGuardar={(hi, hf) =>
          horarioTarget && guardarHorarioDia.mutate({ id: horarioTarget.id, fecha: horarioTarget.fecha, hi, hf })
        }
        onQuitar={() =>
          horarioTarget &&
          guardarHorarioDia.mutate({ id: horarioTarget.id, fecha: horarioTarget.fecha, hi: null, hf: null })
        }
      />
    </SafeAreaView>
  );
}

const CLAVE_DESCARTADO = 'agenda_calendario_descartado_v1';
const CLAVE_VISTA = 'agenda_vista_v1';
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const mesDe = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
    semanaNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 6,
    },
    navBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    semanaRango: { fontSize: 15, fontWeight: '800', color: colors.text },
    volverHoy: { fontSize: 12, color: colors.purple, fontWeight: '700', marginTop: 2 },
    vistaSelector: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 999,
      padding: 3,
    },
    vistaBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999 },
    vistaBtnAct: { backgroundColor: colors.purple },
    vistaBtnText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
    vistaBtnTextAct: { color: '#fff' },
    scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
    h1: { fontSize: 20, fontWeight: '800', color: colors.text },
    h2: { fontSize: 16, fontWeight: '800', color: colors.text },
    muted: { fontSize: 12.5, color: colors.textMuted },
    iaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 13,
    },
    iaBtnText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
    revisarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      alignSelf: 'center',
      paddingVertical: 2,
    },
    revisarBtnText: { color: colors.purple, fontWeight: '700', fontSize: 12.5, textDecorationLine: 'underline' },
    calRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    calNombre: { fontSize: 14, fontWeight: '700', color: colors.text },
    calBtn: {
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 18,
    },
    calBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    calOk: { color: colors.green, fontWeight: '800', fontSize: 13 },
    ningunoLink: { color: colors.textMuted, fontWeight: '700', fontSize: 12.5, textDecorationLine: 'underline' },
    diaBloque: { gap: 8 },
    diaHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    diaNombre: { fontSize: 16, fontWeight: '800', color: colors.text },
    diaHoy: { color: colors.purple },
    diaFecha: { fontSize: 12, color: colors.textMuted },
    sinEventos: { fontSize: 12.5, color: colors.textMuted, fontStyle: 'italic' },
    eventoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    puntito: { width: 10, height: 10, borderRadius: 5 },
    tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    eventoTitulo: { fontSize: 14.5, color: colors.text, fontWeight: '600' },
    tag: { backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    tagText: { fontSize: 10.5, color: colors.textMuted, fontWeight: '700' },
  });
