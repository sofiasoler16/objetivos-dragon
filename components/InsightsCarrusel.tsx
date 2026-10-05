import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, type Tema } from '@/constants/theme';
import type { Insight } from '@/logic/progreso';

type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];
const LOCK = 'lock' as const;
type Pagina = Insight | typeof LOCK;

// Carrusel de "insights" del usuario (día más fuerte, hábito que mejor cumple, etc.).
// PREMIUM: ve todas, se mueven solas (~4,5s) y se pueden deslizar.
// NO PREMIUM: ve SOLO la primera; la 2ª "pestaña" es un candado (contenido tapado) → al tocarla
// abre el paywall. No accede al resto.
export function InsightsCarrusel({
  insights,
  esPremium,
  onUpgrade,
}: {
  insights: Insight[];
  esPremium: boolean;
  onUpgrade: () => void;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const ref = useRef<ScrollView>(null);
  const [ancho, setAncho] = useState(0);
  const [idx, setIdx] = useState(0);
  const interactuando = useRef(false);

  // Páginas: premium = todas las estadísticas; gratis = la 1ª + una con candado.
  const paginas: Pagina[] = esPremium ? insights : insights.length > 0 ? [insights[0], LOCK] : [];

  // Auto-avance (loop) SOLO premium. Se salta si el usuario está deslizando.
  useEffect(() => {
    if (!esPremium || paginas.length <= 1 || ancho === 0) return;
    const t = setInterval(() => {
      if (interactuando.current) return;
      setIdx((i) => {
        const next = (i + 1) % paginas.length;
        ref.current?.scrollTo({ x: next * ancho, animated: true });
        return next;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [esPremium, paginas.length, ancho]);

  if (paginas.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ancho === 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / ancho);
    if (i !== idx) setIdx(i);
  };

  return (
    <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          interactuando.current = true;
        }}
        onMomentumScrollEnd={() => {
          interactuando.current = false;
        }}>
        {paginas.map((p) =>
          p === LOCK ? (
            <View key="lock" style={[styles.pagina, { width: ancho }]}>
              <Pressable onPress={onUpgrade} style={styles.lockCard}>
                <View style={styles.lockIconWrap}>
                  <Ionicons name="lock-closed" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockTitulo}>Más estadísticas con Premium 👑</Text>
                  <Text style={styles.lockTexto}>
                    Tu mejor día, tus rachas, en qué mejorás y qué descuidás. Tocá para desbloquear.
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <View key={p.id} style={[styles.pagina, { width: ancho }]}>
              <View style={styles.card}>
                <View style={styles.iconWrap}>
                  <Ionicons name={p.icono as NombreIcono} size={20} color={colors.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo}>{p.titulo}</Text>
                  <Text style={styles.texto}>{p.texto}</Text>
                </View>
              </View>
            </View>
          ),
        )}
      </ScrollView>

      {paginas.length > 1 && (
        <View style={styles.dots}>
          {paginas.map((p, i) => (
            <View key={p === LOCK ? 'lock' : p.id} style={[styles.dot, i === idx && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    // Cada "página" ocupa el ancho completo; un pelín de padding para que la tarjeta no toque
    // el borde donde el carrusel recorta (así no se ve cortada).
    pagina: { paddingHorizontal: 3, paddingVertical: 2 },
    // Tarjeta PLANA (sin sombra: la sombra se recortaba en las esquinas dentro del carrusel).
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 84,
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.cardPurple,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.purple100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titulo: { fontSize: 13.5, fontWeight: '800', color: colors.purple700, marginBottom: 2 },
    texto: { fontSize: 13, color: colors.text, lineHeight: 18 },
    lockCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 84,
      padding: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.purple,
    },
    lockIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#ffffff33',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockTitulo: { fontSize: 13.5, fontWeight: '800', color: '#fff', marginBottom: 2 },
    lockTexto: { fontSize: 12.5, color: '#ffffffdd', lineHeight: 17 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.track },
    dotOn: { backgroundColor: colors.purple, width: 16, borderRadius: radius.sm },
  });
