import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { radius, spacing, type Tema } from '@/constants/theme';
import type { EstadoDragon } from '@/logic/dragon';

// Bandera en el teléfono para mostrar el onboarding una sola vez (subir vN al cambiarlo).
// (Se quitó del tutorial la mención a los Widgets — el código del widget sigue, pero no se
// promociona hasta que funcione bien. No se sube la versión: no hace falta re-mostrarlo.)
const CLAVE = 'onboarding_visto_v2';

/** Borra la marca para que el tutorial vuelva a aparecer la próxima vez que se abra la app. */
export async function reiniciarOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE);
}

/** ¿El usuario ya vio el tutorial? (para no mostrar la promo Premium encima del onboarding). */
export async function onboardingVisto(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) != null;
  } catch {
    return false;
  }
}

// Permite abrir el tutorial AHORA (sin esperar a reabrir la app), ej. desde Perfil.
let emitirMostrar: (() => void) | null = null;
export function mostrarOnboarding(): void {
  emitirMostrar?.();
}

// Aviso de "se cerró el tutorial" → lo usa la promo Premium para aparecer justo después.
const suscriptoresCierre = new Set<() => void>();
export function onOnboardingCerrado(cb: () => void): () => void {
  suscriptoresCierre.add(cb);
  return () => suscriptoresCierre.delete(cb);
}

const PASOS: { expresion: EstadoDragon; titulo: string; texto: string }[] = [
  {
    expresion: 'manana',
    titulo: '¡Hola! Soy tu dragón',
    texto: 'Te voy a acompañar a planificar, cumplir y medir tus objetivos, día a día.',
  },
  {
    expresion: 'animo',
    titulo: '1. Creá tus objetivos',
    texto: 'En la pestaña Objetivos definís qué querés lograr: hábitos diarios, tareas, objetivos.',
  },
  {
    expresion: 'animo',
    titulo: '2. Sumá tus tareas',
    texto: 'Las tareas son cosas puntuales con fecha límite. También se agregan desde Objetivos.',
  },
  {
    expresion: 'orgullo',
    titulo: '3. Mirá tu día en Hoy',
    texto: 'En Hoy ves lo que toca hoy y lo vas marcando. ¡Esto aumenta tu porcentaje de progreso!.',
  },
  {
    expresion: 'orgullo',
    titulo: '4. Recompensas',
    texto: 'Logrando tus metas ganas recompensas. Con las monedas podes conseguir nuevos dragones.',
  },
  {
    expresion: 'festejo',
    titulo: '5. Revisá tu Progreso',
    texto:
      'En Progreso ves tu consistencia, tu racha y tus logros a lo largo del tiempo. ¡Vamos a empezar! 🎉',
  },
];

export function Onboarding() {
  const styles = makeStyles(useTheme());
  const [visible, setVisible] = useState(false);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE).then((v) => {
      if (!v) setVisible(true);
    });
    // Abrir el tutorial al instante cuando se llama mostrarOnboarding() (ej. desde Perfil).
    emitirMostrar = () => {
      setPaso(0);
      setVisible(true);
    };
    return () => {
      emitirMostrar = null;
    };
  }, []);

  function cerrar() {
    AsyncStorage.setItem(CLAVE, '1').catch(() => {});
    setVisible(false);
    // Avisar a la promo Premium que el tutorial terminó (para aparecer justo después).
    suscriptoresCierre.forEach((cb) => cb());
  }

  const irAtras = () => setPaso((p) => Math.max(0, p - 1));
  const irSiguiente = () => setPaso((p) => Math.min(PASOS.length - 1, p + 1));

  // Deslizar para cambiar de paso (izquierda = siguiente, derecha = atrás).
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -40) irSiguiente();
        else if (g.dx >= 40) irAtras();
      },
    }),
  ).current;

  const actual = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  const primero = paso === 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={cerrar}>
      <View style={styles.overlay}>
        <View style={styles.card} {...pan.panHandlers}>
          <Pressable style={styles.saltar} onPress={cerrar} hitSlop={8}>
            <Text style={styles.saltarText}>Saltar</Text>
          </Pressable>

          <DragonMascot size={130} expresion={actual.expresion} style={{ height: 160 }} />
          <Text style={styles.titulo}>{actual.titulo}</Text>
          <Text style={styles.texto}>{actual.texto}</Text>

          <View style={styles.dots}>
            {PASOS.map((_, i) => (
              <View key={i} style={[styles.dot, i === paso && styles.dotOn]} />
            ))}
          </View>

          <View style={styles.botones}>
            <Pressable
              style={[styles.btnAtras, primero && styles.btnAtrasOculto]}
              onPress={irAtras}
              disabled={primero}
              hitSlop={8}>
              <Text style={styles.btnAtrasText}>Atrás</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => (ultimo ? cerrar() : irSiguiente())}>
              <Text style={styles.btnText}>{ultimo ? '¡Empezar!' : 'Siguiente'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(36,31,56,0.5)',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: 12,
    },
    saltar: { position: 'absolute', top: 14, right: 16, padding: 4 },
    saltarText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
    titulo: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
    texto: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    dots: { flexDirection: 'row', gap: 7, marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.track },
    dotOn: { backgroundColor: colors.purple, width: 20 },
    botones: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 6 },
    btnAtras: { paddingVertical: 13, paddingHorizontal: 14 },
    btnAtrasOculto: { opacity: 0 },
    btnAtrasText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
    btn: {
      flex: 1,
      backgroundColor: colors.purple,
      borderRadius: radius.pill,
      paddingVertical: 13,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
