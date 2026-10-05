import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tema } from '@/constants/theme';
import type { DiaAgenda } from '@/lib/data';

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Un color por ítem del día (para los puntitos), máx 4 — así 2 objetivos = 2 puntitos. */
function coloresDelDia(dia: DiaAgenda, fallback: string): string[] {
  return dia.items.slice(0, 4).map((it) => it.color ?? fallback);
}

/**
 * Vista "Mes" (resumen): grilla de 6 semanas (empieza en lunes). Cada día muestra su número y
 * puntitos de color según sus eventos/objetivos. Tocar un día → `onTapDia` (abre su vista de Día).
 * La navegación (‹ mes ›, sin pasar del mes actual) la maneja la pantalla.
 */
export function VistaMesAgenda({
  mesISO,
  dias,
  colors,
  onTapDia,
}: {
  mesISO: string; // 'YYYY-MM'
  dias: DiaAgenda[]; // 42 días (6 semanas) que cubren la grilla del mes
  colors: Tema;
  onTapDia: (fechaISO: string) => void;
}) {
  const styles = makeStyles(colors);
  // Partimos los 42 días en 6 semanas de 7 → cada fila tiene EXACTAMENTE 7 columnas (flex:1),
  // alineadas con las etiquetas L·M·M·J·V·S·D (antes con flexWrap+% el domingo se caía de fila).
  const semanas: DiaAgenda[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.fila}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={styles.labelDia}>
            {d}
          </Text>
        ))}
      </View>
      {semanas.map((semana, wi) => (
        <View key={wi} style={styles.fila}>
          {semana.map((dia) => {
            const delMes = dia.fechaISO.startsWith(mesISO);
            const puntos = coloresDelDia(dia, colors.purple);
            const num = Number(dia.fechaISO.slice(8, 10));
            return (
              <Pressable key={dia.fechaISO} style={styles.celda} onPress={() => onTapDia(dia.fechaISO)}>
                <View style={[styles.numWrap, dia.esHoy && styles.numHoy]}>
                  <Text
                    style={[styles.num, !delMes && styles.numFuera, dia.esHoy && styles.numHoyText]}>
                    {num}
                  </Text>
                </View>
                <View style={styles.puntos}>
                  {puntos.map((c, i) => (
                    <View key={i} style={[styles.punto, { backgroundColor: c }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    fila: { flexDirection: 'row' },
    labelDia: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: colors.textMuted },
    celda: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      paddingTop: 4,
      gap: 3,
    },
    numWrap: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    numHoy: { backgroundColor: colors.purple },
    num: { fontSize: 13, color: colors.text, fontWeight: '600' },
    numFuera: { color: colors.textMuted, opacity: 0.5 },
    numHoyText: { color: '#fff', fontWeight: '800' },
    puntos: { flexDirection: 'row', gap: 2, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%' },
    punto: { width: 5, height: 5, borderRadius: 2.5 },
  });
