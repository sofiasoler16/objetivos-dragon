import { useRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/components/theme-provider';
import { radius, shadow, spacing, type Tema } from '@/constants/theme';

// Colores del arcoíris para el borde de las tarjetas del tema Arcoíris. Cada tarjeta
// que se monta toma el siguiente color del ciclo (contador de módulo + ref por instancia)
// → en pantalla las tarjetas se ven con bordes de distinto color, como un arcoíris.
const ARCOIRIS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
let contadorArcoiris = 0;

export function Card({ style, ...props }: ViewProps) {
  const colors = useTheme();
  const styles = makeStyles(colors);

  // Índice estable por instancia (se asigna una sola vez, al primer render).
  const idxRef = useRef<number | null>(null);
  if (idxRef.current === null) idxRef.current = contadorArcoiris++;

  // Borde especial según el tema: arcoíris (color rotado) o color fijo (ej. Programador).
  // El resto NO lleva color de borde (el borde transparente del estilo base solo existe para
  // que en Android la sombra siga las esquinas redondeadas y no salga cuadrada).
  let borde: object | undefined;
  if (colors.arcoiris) {
    borde = { borderColor: ARCOIRIS[idxRef.current % ARCOIRIS.length] };
  } else if (colors.cardBorde) {
    borde = { borderColor: colors.cardBorde };
  }

  return <View style={[styles.card, shadow.sm, borde, style]} {...props} />;
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      // Borde transparente de 1.5px en TODAS las tarjetas: no se ve, pero hace que Android
      // dibuje la sombra (elevation) siguiendo las esquinas redondeadas (si no, sale cuadrada).
      // Los temas con borde (Arcoíris/Programador) solo cambian el color, no el ancho.
      borderWidth: 1.5,
      borderColor: 'transparent',
      padding: spacing.lg,
      gap: spacing.sm,
    },
  });
