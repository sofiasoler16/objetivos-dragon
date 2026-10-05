import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimeField } from '@/components/ui/DateTimeField';
import type { Tema } from '@/constants/theme';
import { dateAHora, horaADate } from '@/logic/fecha';

/**
 * Cambiar el horario de un objetivo SOLO para un día (2.d), sin tocar la rutina. Deja elegir
 * desde/hasta y volver al horario normal. Guarda 'HH:MM' (o quita el override).
 */
export function HorarioDiaModal({
  visible,
  titulo,
  fechaLabel,
  horaInicio,
  horaFin,
  colors,
  guardando,
  onCancelar,
  onGuardar,
  onQuitar,
}: {
  visible: boolean;
  titulo?: string;
  fechaLabel?: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  colors: Tema;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (hi: string, hf: string) => void;
  onQuitar: () => void;
}) {
  const styles = makeStyles(colors);
  const [hi, setHi] = useState<Date | null>(null);
  const [hf, setHf] = useState<Date | null>(null);
  useEffect(() => {
    setHi(horaADate(horaInicio ?? null));
    setHf(horaADate(horaFin ?? null));
  }, [horaInicio, horaFin, visible]);

  function guardar() {
    if (!hi || !hf) return Alert.alert('Falta el horario', 'Elegí la hora de inicio y de fin.');
    if (dateAHora(hf) <= dateAHora(hi))
      return Alert.alert('Horario inválido', 'La hora de fin debe ser posterior a la de inicio.');
    onGuardar(dateAHora(hi), dateAHora(hf));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <Pressable style={styles.backdrop} onPress={onCancelar}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.titulo}>Horario solo para este día</Text>
          {(titulo || fechaLabel) && (
            <Text style={styles.sub}>
              {titulo}
              {titulo && fechaLabel ? ' · ' : ''}
              {fechaLabel}
            </Text>
          )}

          <View style={styles.fila}>
            <Text style={styles.label}>Desde</Text>
            <View style={{ flex: 1 }}>
              <DateTimeField mode="time" value={hi} onChange={setHi} formato={dateAHora} placeholder="--:--" />
            </View>
          </View>
          <View style={styles.fila}>
            <Text style={styles.label}>Hasta</Text>
            <View style={{ flex: 1 }}>
              <DateTimeField mode="time" value={hf} onChange={setHf} formato={dateAHora} placeholder="--:--" />
            </View>
          </View>

          <Pressable style={[styles.guardar, guardando && { opacity: 0.5 }]} disabled={guardando} onPress={guardar}>
            <Text style={styles.guardarText}>{guardando ? 'Guardando…' : 'Guardar solo para este día'}</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={onQuitar} disabled={guardando}>
            <Text style={styles.linkText}>Volver al horario normal</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={onCancelar}>
            <Text style={styles.cancelarText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 22 },
    card: { backgroundColor: colors.bg, borderRadius: 16, padding: 18, gap: 12 },
    titulo: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
    sub: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: -6 },
    fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    label: { fontSize: 14, fontWeight: '700', color: colors.text, width: 60 },
    guardar: { backgroundColor: colors.purple, borderRadius: 999, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
    guardarText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
    link: { alignItems: 'center', paddingVertical: 6 },
    linkText: { color: colors.purple, fontWeight: '700', fontSize: 13 },
    cancelarText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  });
