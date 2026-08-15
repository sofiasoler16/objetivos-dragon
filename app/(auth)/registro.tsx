import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { type Tema } from '@/constants/theme';
import { registrarse } from '@/lib/data';

export default function RegistroScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const { session } = await registrarse({
        email: email.trim(),
        password,
        nombre: nombre.trim(),
      });
      // Si el proyecto pide confirmar email, no hay sesión todavía.
      if (!session) {
        setAviso('Te registramos. Revisá tu email para confirmar la cuenta y después ingresá.');
      }
      // Con sesión activa, el guard de rutas redirige solo.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <DragonMascot size={80} style={styles.dragon} />
        <Text style={styles.title}>Crear cuenta</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña (mín. 6)"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {aviso && <Text style={styles.aviso}>{aviso}</Text>}

        <Pressable
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={onSubmit}
          disabled={cargando}>
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>Registrarme</Text>
          )}
        </Pressable>

        <View style={styles.linkFila}>
          <Text style={styles.linkTexto}>¿Ya tenés cuenta? </Text>
          <Link href="/login" style={styles.link}>
            Ingresá
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  dragon: { alignSelf: 'center', marginBottom: 4 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    color: colors.purple700,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.red, fontSize: 14 },
  aviso: { color: colors.green700, fontSize: 14 },
  boton: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkFila: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  linkTexto: { color: colors.textMuted },
  link: { color: colors.purple, fontWeight: '700' },
});
