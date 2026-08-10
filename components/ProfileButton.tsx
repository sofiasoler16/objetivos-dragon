import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';

/** Botón de avatar arriba a la derecha — abre el perfil / plan / cerrar sesión. */
export function ProfileButton() {
  return (
    <Link href="/perfil" asChild>
      <Pressable style={styles.btn} hitSlop={8}>
        <Ionicons name="person-outline" size={17} color={colors.purple} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.purple100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
