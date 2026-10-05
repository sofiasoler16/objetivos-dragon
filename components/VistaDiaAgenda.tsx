import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tema } from '@/constants/theme';
import type { ItemAgenda } from '@/lib/data';

const ALTO_HORA = 56; // px por hora
const ANCHO_LABEL = 42;

/** Minutos desde medianoche (hora local) de un ISO. */
function minutos(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
/** 'HH:MM' local de un ISO. */
function hhmm(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Bloque = { it: ItemAgenda; ini: number; fin: number; col: number; cols: number };

/**
 * Reparte los eventos con hora en COLUMNAS cuando se solapan (como Google Calendar): los que se
 * pisan en horario se dibujan lado a lado en vez de encimados. Devuelve cada bloque con su columna
 * y cuántas columnas tiene su "grupo" de solapados.
 */
function repartirEnColumnas(items: ItemAgenda[]): Bloque[] {
  const evs: Bloque[] = items
    .map((it) => {
      const ini = minutos(it.inicio);
      const fin = Math.max(minutos(it.fin), ini + 20); // mínimo 20 min para solapar/mostrar
      return { it, ini, fin, col: 0, cols: 1 };
    })
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin);

  let i = 0;
  while (i < evs.length) {
    // Un "grupo" = eventos que se solapan en cadena.
    const finesColumna: number[] = [];
    const grupo: Bloque[] = [];
    let finGrupo = evs[i].fin;
    let j = i;
    while (j < evs.length && evs[j].ini < finGrupo) {
      const e = evs[j];
      let col = finesColumna.findIndex((fin) => fin <= e.ini);
      if (col === -1) {
        col = finesColumna.length;
        finesColumna.push(e.fin);
      } else {
        finesColumna[col] = e.fin;
      }
      e.col = col;
      finGrupo = Math.max(finGrupo, e.fin);
      grupo.push(e);
      j++;
    }
    for (const e of grupo) e.cols = finesColumna.length;
    i = j;
  }
  return evs;
}

/**
 * Vista "Día" estilo Google Calendar: franja de "todo el día" arriba + grilla de horas con cada
 * evento/objetivo como bloque de color ubicado por su horario (lado a lado si se solapan). La
 * navegación entre días la maneja la pantalla. Tocar un bloque → `onTapItem`.
 */
export function VistaDiaAgenda({
  items,
  colors,
  onTapItem,
}: {
  items: ItemAgenda[];
  colors: Tema;
  onTapItem: (item: ItemAgenda) => void;
}) {
  const styles = makeStyles(colors);
  const todoElDia = items.filter((i) => i.todoElDia);
  const conHora = items.filter((i) => !i.todoElDia);
  const bloques = repartirEnColumnas(conHora);

  // Día completo (00–24) como Google Calendar, para ver/agregar objetivos a cualquier hora.
  const desde = 0;
  const hasta = 24;
  const horas: number[] = [];
  for (let h = desde; h < hasta; h++) horas.push(h);
  const altoGrilla = (hasta - desde) * ALTO_HORA;

  return (
    <View style={{ gap: 10 }}>
      {todoElDia.length > 0 && (
        <View style={styles.todoElDia}>
          <Text style={styles.todoElDiaLabel}>Todo el día</Text>
          <View style={{ flex: 1, gap: 6 }}>
            {todoElDia.map((it) => (
              <Pressable key={it.id} style={styles.chip} onPress={() => onTapItem(it)}>
                <View style={[styles.chipDot, { backgroundColor: it.color ?? colors.purple }]} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {(it.esTarea ? '📌' : it.esApp ? '🐉' : '📅') + ' ' + it.titulo}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: altoGrilla }}>
        {/* Líneas y etiquetas de hora */}
        {horas.map((h) => (
          <View key={h} style={[styles.lineaHora, { top: (h - desde) * ALTO_HORA }]}>
            <Text style={styles.horaLabel}>{String(h).padStart(2, '0')}</Text>
            <View style={styles.linea} />
          </View>
        ))}

        {/* Capa de eventos (a la derecha de las etiquetas). Ancho por columnas en %. */}
        <View style={styles.capaEventos}>
          {bloques.map((b) => {
            const top = ((b.ini - desde * 60) / 60) * ALTO_HORA;
            const alto = Math.max(24, ((minutos(b.it.fin) - b.ini) / 60) * ALTO_HORA);
            const color = b.it.color ?? colors.purple;
            // 🐉 = objetivo de la app · 📌 = tarea de la app · 📅 = evento externo (de tu calendario,
            // NO editable desde acá). Así se distingue de un vistazo qué es tuyo y qué viene de Google.
            const marca = b.it.esTarea ? '📌' : b.it.esApp ? '🐉' : '📅';
            const tipo = b.it.esTarea ? 'tarea' : b.it.esApp ? 'objetivo' : 'de tu calendario';
            const rango = b.it.esTarea ? `Vence ${hhmm(b.it.inicio)}` : `${hhmm(b.it.inicio)}–${hhmm(b.it.fin)}`;
            return (
              <Pressable
                key={b.it.id}
                onPress={() => onTapItem(b.it)}
                style={[
                  styles.bloque,
                  {
                    top,
                    height: alto,
                    left: `${(b.col / b.cols) * 100}%`,
                    width: `${(1 / b.cols) * 100}%`,
                    backgroundColor: color + '2A',
                    borderLeftColor: color,
                  },
                ]}>
                <Text style={styles.bloqueTitulo} numberOfLines={alto > 34 ? 2 : 1}>
                  {marca} {b.it.titulo}
                </Text>
                {alto > 34 && (
                  <Text style={styles.bloqueHora} numberOfLines={1}>
                    {rango} · {tipo}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    todoElDia: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    todoElDiaLabel: { width: ANCHO_LABEL, fontSize: 10.5, color: colors.textMuted, fontWeight: '700', paddingTop: 4 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { flex: 1, fontSize: 12.5, color: colors.text, fontWeight: '600' },
    lineaHora: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    horaLabel: { width: ANCHO_LABEL, fontSize: 10.5, color: colors.textMuted, textAlign: 'right', paddingRight: 6, marginTop: -6 },
    linea: { flex: 1, height: 1, backgroundColor: colors.track },
    capaEventos: { position: 'absolute', left: ANCHO_LABEL + 6, right: 2, top: 0, bottom: 0 },
    bloque: {
      position: 'absolute',
      borderRadius: 7,
      borderLeftWidth: 3,
      paddingVertical: 3,
      paddingHorizontal: 6,
      marginRight: 2,
      overflow: 'hidden',
    },
    bloqueTitulo: { fontSize: 12, color: colors.text, fontWeight: '700' },
    bloqueHora: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  });
