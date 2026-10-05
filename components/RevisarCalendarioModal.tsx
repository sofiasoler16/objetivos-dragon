import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Tema } from '@/constants/theme';
import type { CambioCalendario } from '@/lib/data';

const ICONO: Record<CambioCalendario['tipo'], keyof typeof Ionicons.glyphMap> = {
  baja: 'trash-outline',
  hora: 'time-outline',
  dias: 'calendar-outline',
  'hora-dia': 'today-outline',
};

/**
 * Muestra los cambios detectados EN el calendario y deja elegir cuáles aplicar a los objetivos.
 * 🔒 Nada se aplica hasta que la usuaria toca "Aplicar". Las bajas conservan el historial.
 */
export function RevisarCalendarioModal({
  visible,
  cambios,
  colors,
  aplicando,
  onCancelar,
  onAplicar,
}: {
  visible: boolean;
  cambios: CambioCalendario[];
  colors: Tema;
  aplicando: boolean;
  onCancelar: () => void;
  onAplicar: (seleccionados: CambioCalendario[]) => void;
}) {
  const styles = makeStyles(colors);
  const [sel, setSel] = useState<boolean[]>([]);
  useEffect(() => {
    // Al abrir, por defecto todos tildados.
    setSel(cambios.map(() => true));
  }, [cambios]);

  const seleccionados = cambios.filter((_, i) => sel[i]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Text style={styles.h1}>Cambios en tu calendario</Text>
          <Pressable onPress={onCancelar} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.intro}>
          Estos cambios los hiciste en tu calendario. Elegí cuáles aplicar a tus objetivos:
        </Text>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {cambios.map((c, i) => (
            <Pressable
              key={c.idObjetivo + i}
              style={styles.fila}
              onPress={() => setSel((s) => s.map((v, k) => (k === i ? !v : v)))}>
              <View style={[styles.check, sel[i] && styles.checkOn]}>
                {sel[i] && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Ionicons name={ICONO[c.tipo]} size={18} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>{c.titulo}</Text>
                <Text style={styles.desc}>{c.descripcion}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.pie}>
          <Pressable
            style={[styles.aplicar, (seleccionados.length === 0 || aplicando) && { opacity: 0.5 }]}
            disabled={seleccionados.length === 0 || aplicando}
            onPress={() => onAplicar(seleccionados)}>
            <Text style={styles.aplicarText}>
              {aplicando ? 'Aplicando…' : `Aplicar (${seleccionados.length})`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    h1: { fontSize: 19, fontWeight: '800', color: colors.text },
    intro: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 16, paddingTop: 4 },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.track,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.purple, borderColor: colors.purple },
    titulo: { fontSize: 14.5, fontWeight: '700', color: colors.text },
    desc: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
    pie: { padding: 16 },
    aplicar: {
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    aplicarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
