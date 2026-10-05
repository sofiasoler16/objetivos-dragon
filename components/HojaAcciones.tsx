import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tema } from '@/constants/theme';

export type OpcionAccion = { texto: string; onPress: () => void; destructivo?: boolean };

/**
 * Menú de acciones propio (hoja que sube desde abajo), en vez de Alert con muchos botones: Android
 * solo muestra 3 botones en un Alert, así que las opciones extra + "Cancelar" se perdían. Acá se ven
 * TODAS + "Cancelar" siempre. Tocar el fondo o Cancelar cierra sin hacer nada.
 */
export function HojaAcciones({
  visible,
  titulo,
  opciones,
  colors,
  onCerrar,
}: {
  visible: boolean;
  titulo?: string;
  opciones: OpcionAccion[];
  colors: Tema;
  onCerrar: () => void;
}) {
  const styles = makeStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.backdrop} onPress={onCerrar}>
        {/* Contenedor: frena la propagación para que tocar la hoja no la cierre. */}
        <Pressable style={styles.hoja} onPress={() => {}}>
          {titulo ? (
            <Text style={styles.titulo} numberOfLines={2}>
              {titulo}
            </Text>
          ) : null}
          <View style={styles.grupo}>
            {opciones.map((o, i) => (
              <Pressable
                key={i}
                style={[styles.opcion, i > 0 && styles.conBorde]}
                onPress={o.onPress}>
                <Text style={[styles.opcionText, o.destructivo && { color: colors.red }]}>
                  {o.texto}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.grupo, styles.opcion]} onPress={onCerrar}>
            <Text style={styles.cancelarText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end', padding: 10 },
    hoja: { gap: 8 },
    titulo: { textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: '700', paddingBottom: 2 },
    grupo: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
    opcion: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
    conBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.track },
    opcionText: { fontSize: 16, color: colors.text, fontWeight: '600' },
    cancelarText: { fontSize: 16, color: colors.purple, fontWeight: '800' },
  });
