import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, spacing, type Tema } from '@/constants/theme';

/**
 * Modal para escribir la razón (OPCIONAL) al omitir un objetivo un día.
 * "Omitir" confirma con lo escrito (vacío = sin razón); "Cancelar" no omite.
 */
export function RazonOmisionModal({
  visible,
  nombre,
  onCancelar,
  onConfirmar,
}: {
  visible: boolean;
  nombre?: string;
  onCancelar: () => void;
  onConfirmar: (razon: string | null) => void;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (visible) setTexto('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <Pressable style={styles.overlay} onPress={onCancelar}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Omitir{nombre ? ` “${nombre}”` : ''}</Text>
            <Text style={styles.sub}>¿Por qué lo omitís? (opcional)</Text>
            <TextInput
              style={styles.input}
              value={texto}
              onChangeText={setTexto}
              placeholder="Ej: estaba enferma, día de descanso…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              multiline
            />
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancelar}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => onConfirmar(texto.trim() || null)}>
                <Text style={styles.btnPrimaryText}>Omitir</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: '#00000066',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    center: { width: '100%' },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 8,
    },
    title: { fontSize: 17, fontWeight: '800', color: colors.text },
    sub: { fontSize: 13, color: colors.textMuted },
    input: {
      minHeight: 64,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: radius.md,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      textAlignVertical: 'top',
      marginTop: 4,
    },
    row: { flexDirection: 'row', gap: 10, marginTop: 6 },
    btn: { flex: 1, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
    btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
    btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.text },
    btnPrimary: { backgroundColor: colors.purple },
    btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  });
