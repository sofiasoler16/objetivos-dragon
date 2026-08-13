import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonButton } from '@/components/DragonButton';
import { DragonMascot } from '@/components/DragonMascot';
import { ProfileButton } from '@/components/ProfileButton';
import { StatsPills } from '@/components/StatsPills';
import { useTheme } from '@/components/theme-provider';
import { useDragonEquipado } from '@/hooks/useDragonEquipado';
import { useRevisarLogros } from '@/hooks/useRevisarLogros';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { SpeechBubble } from '@/components/ui/SpeechBubble';
import { spacing } from '@/constants/theme';
import { completarTarea, listarCategorias, listarObjetivosConDias, listarTareas } from '@/lib/data';
import { type Tema } from '@/constants/theme';
import { resumenFrecuencia } from '@/logic/objetivos';
import { resumenTarea } from '@/logic/tareas';

export default function ObjetivosScreen() {
  const queryClient = useQueryClient();
  const revisarLogros = useRevisarLogros();
  const colors = useTheme();
  const styles = makeStyles(colors);
  const assetKeyDragon = useDragonEquipado();

  const {
    data: objetivos,
    isLoading: cargandoObj,
    isError: errorObj,
    refetch: refetchObj,
  } = useQuery({
    queryKey: ['objetivos'],
    queryFn: () => listarObjetivosConDias({ soloActivos: true }),
  });
  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  const {
    data: tareas,
    isLoading: cargandoTareas,
    isError: errorTareas,
    refetch: refetchTareas,
  } = useQuery({ queryKey: ['tareas'], queryFn: () => listarTareas() });
  const catMap = new Map((categorias ?? []).map((c) => [c.id_categoria, c]));

  const completar = useMutation({
    mutationFn: ({ id, completada, prioridad }: { id: string; completada: boolean; prioridad: 'BAJA' | 'MEDIA' | 'ALTA' }) =>
      completarTarea(id, completada, prioridad),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
      queryClient.invalidateQueries({ queryKey: ['coleccion'] });
      if (v.completada) revisarLogros();
    },
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
            <Ionicons name="flag-outline" size={22} color={colors.purple} />
            <Text style={styles.h1}>Objetivos</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <SpeechBubble maxWidth={118} tail="right">Definí, organizá y cumplí tus metas</SpeechBubble>
            <DragonMascot assetKey={assetKeyDragon} size={84} />
          </View>
        </View>

        {/* Objetivos recurrentes */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="refresh-outline" size={18} color={colors.purple} />
            <Text style={styles.h2}>Objetivos recurrentes</Text>
          </View>
          <Pressable style={styles.nuevoBtn} onPress={() => router.push('/objetivo/nuevo')}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.nuevoBtnText}>Nuevo</Text>
          </Pressable>
        </View>

        {cargandoObj && <ActivityIndicator style={{ marginTop: 12 }} />}
        {errorObj && (
          <EstadoMensaje
            titulo="No pudimos cargar tus objetivos"
            subtitulo="Revisá tu conexión e intentá de nuevo."
            onReintentar={() => refetchObj()}
          />
        )}
        {!cargandoObj && !errorObj && objetivos?.length === 0 && (
          <EstadoMensaje
            conDragon
            titulo="Todavía no tenés objetivos"
            subtitulo="Tocá “Nuevo” para crear el primero y empezá a construir tus hábitos."
          />
        )}
        <View style={{ gap: 10 }}>
          {objetivos?.map((o) => {
            const cat = o.id_categoria ? catMap.get(o.id_categoria) : undefined;
            return (
              <Card key={o.id_objetivo} style={styles.listRow}>
                <View style={[styles.badge, { backgroundColor: (cat?.color ?? colors.purple) + '22' }]}>
                  <Text style={{ fontSize: 20 }}>{cat?.icono ?? '🎯'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{o.nombre}</Text>
                  <Text style={styles.muted}>{resumenFrecuencia(o)}</Text>
                </View>
                <Pressable style={styles.editBtn} onPress={() => router.push(`/objetivo/${o.id_objetivo}`)}>
                  <Text style={styles.editBtnText}>Editar</Text>
                </Pressable>
              </Card>
            );
          })}
        </View>

        {/* Tareas */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="document-text-outline" size={18} color={colors.purple} />
            <Text style={styles.h2}>Tareas</Text>
          </View>
          <Pressable style={styles.nuevoBtn} onPress={() => router.push('/tarea/nuevo')}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.nuevoBtnText}>Nueva</Text>
          </Pressable>
        </View>

        {cargandoTareas && <ActivityIndicator style={{ marginTop: 12 }} />}
        {errorTareas && (
          <EstadoMensaje
            titulo="No pudimos cargar tus tareas"
            subtitulo="Revisá tu conexión e intentá de nuevo."
            onReintentar={() => refetchTareas()}
          />
        )}
        {!cargandoTareas && !errorTareas && tareas?.length === 0 && (
          <Text style={styles.vacio}>No tenés tareas. Tocá “Nueva” para agregar una.</Text>
        )}
        <View style={{ gap: 10 }}>
          {tareas?.map((t) => (
            <Card key={t.id_tarea} style={styles.listRow}>
              <Pressable
                hitSlop={6}
                onPress={() =>
                  completar.mutate({ id: t.id_tarea, completada: !t.completada, prioridad: t.prioridad })
                }>
                <View style={[styles.checkbox, t.completada && styles.checkboxDone]}>
                  {t.completada && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, t.completada && styles.itemDone]}>{t.titulo}</Text>
                <Text style={styles.muted}>{resumenTarea(t)}</Text>
              </View>
              <Pressable style={styles.editBtn} onPress={() => router.push(`/tarea/${t.id_tarea}`)}>
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  nuevoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.purple,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  nuevoBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  vacio: { color: colors.textMuted, marginTop: 8 },
  muted: { fontSize: 12, color: colors.textMuted },
  itemTitle: { fontSize: 14.5, color: colors.text },
  itemDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { borderColor: colors.green, backgroundColor: colors.green },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  editBtnText: { fontSize: 13, fontWeight: '800', color: colors.text },
});
