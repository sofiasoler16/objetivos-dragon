import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/components/theme-provider';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  actualizarCategoria,
  type Categoria,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
} from '@/lib/data';

const EMOJIS = ['🏋️', '🎓', '🙂', '❤️', '📚', '💼', '🎨', '🧘', '🍎', '💰', '✈️', '🎵', '🏃', '🛌', '🧠', '🌱'];
const COLORS = ['#8B5CF6', '#22C55E', '#3B82F6', '#E08A2C', '#EF4444', '#EC4899', '#14B8A6', '#6366F1'];

export default function CategoriasScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const { data: categorias, isLoading, error } = useQuery({
    queryKey: ['categorias'],
    queryFn: listarCategorias,
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['categorias'] });

  const crear = useMutation({ mutationFn: crearCategoria, onSuccess: invalidar });
  const actualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<Categoria> }) =>
      actualizarCategoria(id, cambios),
    onSuccess: invalidar,
  });
  const eliminar = useMutation({ mutationFn: eliminarCategoria, onSuccess: invalidar });

  const guardando = crear.isPending || actualizar.isPending;

  function abrirNueva() {
    setEditando(null);
    setNombre('');
    setIcono(EMOJIS[0]);
    setColor(COLORS[0]);
    setModalAbierto(true);
  }

  function abrirEdicion(c: Categoria) {
    setEditando(c);
    setNombre(c.nombre);
    setIcono(c.icono ?? EMOJIS[0]);
    setColor(c.color ?? COLORS[0]);
    setModalAbierto(true);
  }

  async function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      Alert.alert('Falta el nombre', 'Poné un nombre para la categoría.');
      return;
    }
    try {
      if (editando) {
        await actualizar.mutateAsync({
          id: editando.id_categoria,
          cambios: { nombre: nombreLimpio, icono, color },
        });
      } else {
        await crear.mutateAsync({ nombre: nombreLimpio, icono, color });
      }
      setModalAbierto(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  }

  function confirmarBorrado(c: Categoria) {
    Alert.alert('Eliminar categoría', `¿Seguro que querés eliminar "${c.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          eliminar.mutate(c.id_categoria, {
            onError: (e) =>
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar.'),
          }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.h1}>Categorías</Text>
        <Pressable onPress={abrirNueva} hitSlop={8} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        {categorias?.length === 0 && !isLoading && (
          <Text style={styles.vacio}>Todavía no tenés categorías. Tocá + para crear una.</Text>
        )}

        <View style={{ gap: 10 }}>
          {categorias?.map((c) => (
            <Card key={c.id_categoria} style={styles.row}>
              <View style={[styles.badge, { backgroundColor: (c.color ?? COLORS[0]) + '22' }]}>
                <Text style={{ fontSize: 20 }}>{c.icono ?? '🙂'}</Text>
              </View>
              <Text style={styles.nombre}>{c.nombre}</Text>
              <Pressable onPress={() => abrirEdicion(c)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="pencil" size={17} color={colors.purple} />
              </Pressable>
              <Pressable onPress={() => confirmarBorrado(c)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={17} color={colors.red} />
              </Pressable>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Formulario crear / editar */}
      <Modal visible={modalAbierto} transparent animationType="slide" onRequestClose={() => setModalAbierto(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalAbierto(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editando ? 'Editar categoría' : 'Nueva categoría'}</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Fitness"
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />

          <Text style={styles.label}>Ícono</Text>
          <View style={styles.pickerWrap}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setIcono(e)}
                style={[styles.emojiOpt, icono === e && styles.emojiOptSel]}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Color</Text>
          <View style={styles.pickerWrap}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorOpt, { backgroundColor: c }, color === c && styles.colorOptSel]}
              />
            ))}
          </View>

          <View style={styles.sheetBtns}>
            <Pressable style={styles.cancelBtn} onPress={() => setModalAbierto(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, guardando && { opacity: 0.6 }]} onPress={guardar} disabled={guardando}>
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  h1: { fontSize: 20, fontWeight: '800', color: colors.text },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  error: { color: colors.red, marginTop: 16 },
  vacio: { color: colors.textMuted, textAlign: 'center', marginTop: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nombre: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  iconBtn: { padding: 6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(36,31,56,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 32,
    gap: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 8 },
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
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  emojiOpt: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptSel: { borderColor: colors.purple },
  colorOpt: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: 'transparent' },
  colorOptSel: { borderColor: colors.text },
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  saveBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.purple,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
