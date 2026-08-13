import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { radius, spacing, type Tema } from '@/constants/theme';
import type { EstadoDragon } from '@/logic/dragon';

// Bandera en el teléfono para mostrar el onboarding una sola vez (subir vN al cambiarlo).
const CLAVE = 'onboarding_visto_v1';

/** Borra la marca para que el tutorial vuelva a aparecer la próxima vez que se abra la app. */
export async function reiniciarOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE);
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
    texto: 'En Progreso ves tu consistencia, tu racha y tus logros. ¡Vamos a empezar! 🎉',
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
  }, []);

  function cerrar() {
    AsyncStorage.setItem(CLAVE, '1').catch(() => {});
    setVisible(false);
  }

  const actual = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={cerrar}>
      <View style={styles.overlay}>
        <View style={styles.card}>
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

          <Pressable style={styles.btn} onPress={() => (ultimo ? cerrar() : setPaso(paso + 1))}>
            <Text style={styles.btnText}>{ultimo ? '¡Empezar!' : 'Siguiente'}</Text>
          </Pressable>
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
    btn: {
      marginTop: 6,
      backgroundColor: colors.purple,
      borderRadius: radius.pill,
      paddingVertical: 13,
      paddingHorizontal: 40,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
