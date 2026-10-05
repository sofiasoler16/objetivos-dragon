import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { type Tema } from '@/constants/theme';
import { googleLoginDisponible, iniciarSesion, iniciarSesionConGoogle } from '@/lib/data';

export default function LoginScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mostrarGoogle = googleLoginDisponible();

  async function onSubmit() {
    setError(null);
    setCargando(true);
    try {
      await iniciarSesion({ email: email.trim(), password });
      // No navego a mano: el guard de rutas redirige al haber sesión.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setCargandoGoogle(true);
    try {
      await iniciarSesionConGoogle();
      // El guard de rutas entra solo al haber sesión.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión con Google.');
    } finally {
      setCargandoGoogle(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <DragonMascot size={80} style={styles.dragon} />
          <Text style={styles.title}>Ingresar</Text>

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
          <View style={styles.passRow}>
            <TextInput
              style={styles.passInput}
              placeholder="Contraseña"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!mostrarPass}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable hitSlop={8} onPress={() => setMostrarPass((v) => !v)}>
              <Ionicons
                name={mostrarPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <Link href={'/recuperar' as Href} style={styles.linkOlvide}>
            ¿Olvidaste tu contraseña?
          </Link>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.boton, cargando && styles.botonDeshabilitado]}
            onPress={onSubmit}
            disabled={cargando}>
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonTexto}>Entrar</Text>
            )}
          </Pressable>

          {mostrarGoogle && (
            <>
              <View style={styles.separadorFila}>
                <View style={styles.separadorLinea} />
                <Text style={styles.separadorTexto}>o</Text>
                <View style={styles.separadorLinea} />
              </View>
              <Pressable
                style={[styles.botonGoogle, cargandoGoogle && styles.botonDeshabilitado]}
                onPress={onGoogle}
                disabled={cargandoGoogle || cargando}>
                {cargandoGoogle ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color={colors.text} />
                    <Text style={styles.botonGoogleTexto}>Entrar con Google</Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          <View style={styles.linkFila}>
            <Text style={styles.linkTexto}>¿No tenés cuenta? </Text>
            <Link href="/registro" style={styles.link}>
              Registrate
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
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
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  passInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text },
  error: { color: colors.red, fontSize: 14 },
  boton: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  separadorFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  separadorLinea: { flex: 1, height: 1, backgroundColor: colors.divider },
  separadorTexto: { color: colors.textMuted, fontSize: 13 },
  botonGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    paddingVertical: 13,
  },
  botonGoogleTexto: { color: colors.text, fontSize: 16, fontWeight: '700' },
  linkOlvide: { color: colors.purple, fontWeight: '700', fontSize: 13, alignSelf: 'flex-end', marginTop: -4 },
  linkFila: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  linkTexto: { color: colors.textMuted },
  link: { color: colors.purple, fontWeight: '700' },
});
