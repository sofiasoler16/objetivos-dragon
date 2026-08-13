import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, type Tema } from '@/constants/theme';

/**
 * Campo de fecha u hora con selector NATIVO de rueda (spinner). Reemplaza el texto
 * a mano. Abre mostrando el día/hora actual si no hay valor. Funciona en Expo Go.
 * En Android el spinner sale como diálogo; en iOS lo mostramos en un modal con "Listo".
 */
export function DateTimeField({
  mode,
  value,
  onChange,
  onClear,
  placeholder = 'Elegir',
  minimumDate,
  formato,
}: {
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (d: Date) => void;
  onClear?: () => void;
  placeholder?: string;
  minimumDate?: Date;
  formato: (d: Date) => string;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const [abierto, setAbierto] = useState(false);
  const base = value ?? valorInicial(); // arranca en hoy/ahora si está vacío

  function alCambiarAndroid(e: DateTimePickerEvent, d?: Date) {
    setAbierto(false);
    if (e.type === 'set' && d) onChange(d);
  }

  return (
    <View>
      <Pressable style={styles.field} onPress={() => setAbierto(true)}>
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={18}
          color={colors.purple}
        />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formato(value) : placeholder}
        </Text>
        {value && onClear ? (
          <Pressable hitSlop={8} onPress={onClear}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        )}
      </Pressable>

      {abierto &&
        (Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
            <Pressable style={styles.overlay} onPress={() => setAbierto(false)}>
              <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                <DateTimePicker
                  value={base}
                  mode={mode}
                  display="spinner"
                  minimumDate={minimumDate}
                  onChange={(e, d) => {
                    if (e.type === 'set' && d) onChange(d);
                  }}
                />
                <Pressable style={styles.doneBtn} onPress={() => setAbierto(false)}>
                  <Text style={styles.doneText}>Listo</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={base}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            onChange={alCambiarAndroid}
          />
        ))}
    </View>
  );
}

function valorInicial(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    value: { flex: 1, fontSize: 16, color: colors.text },
    placeholder: { color: colors.textMuted },
    overlay: { flex: 1, backgroundColor: 'rgba(36,31,56,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingBottom: 24,
    },
    doneBtn: {
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: 40,
      backgroundColor: colors.purple,
      borderRadius: radius.pill,
      marginTop: 4,
    },
    doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
