import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { enviarCodigoRecuperacion, restablecerPassword } from '@/lib/data';

export default function RecuperarScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  const [paso, setPaso] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEnviarCodigo() {
    setError(null);
    if (!email.trim()) return setError('Escribí tu email.');
    setCargando(true);
    try {
      await enviarCodigoRecuperacion(email);
      setPaso('codigo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el código.');
    } finally {
      setCargando(false);
    }
  }

  async function onRestablecer() {
    setError(null);
    if (codigo.trim().length < 6) return setError('Ingresá el código que te llegó por email.');
    if (nueva.length < 6) return setError('La nueva contraseña tiene que tener al menos 6 caracteres.');
    setCargando(true);
    try {
      await restablecerPassword({ email, codigo, nuevaPassword: nueva });
      // Al verificar el código el usuario queda con sesión → el guard entra a la app.
      Alert.alert('¡Listo!', 'Tu contraseña se cambió. Ya estás dentro de la app 🐉');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'El código no es válido o venció. Pedí uno nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <DragonMascot size={80} style={styles.dragon} />
          <Text style={styles.title}>Recuperar contraseña</Text>

          {paso === 'email' ? (
            <>
              <Text style={styles.sub}>
                Escribí tu email y te mandamos un código para cambiar la contraseña.
              </Text>
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
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={[styles.boton, cargando && styles.botonDeshabilitado]}
                onPress={onEnviarCodigo}
                disabled={cargando}>
                {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Enviar código</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sub}>
                Te enviamos un código a <Text style={styles.bold}>{email.trim()}</Text>. Revisá tu correo
                (y la carpeta de spam) e ingresalo acá con tu nueva contraseña.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Código del email"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={codigo}
                onChangeText={(t) => setCodigo(t.replace(/[^0-9]/g, ''))}
                maxLength={10}
              />
              <View style={styles.passRow}>
                <TextInput
                  style={styles.passInput}
                  placeholder="Nueva contraseña"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!mostrarPass}
                  value={nueva}
                  onChangeText={setNueva}
                />
                <Pressable hitSlop={8} onPress={() => setMostrarPass((v) => !v)}>
                  <Ionicons name={mostrarPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={[styles.boton, cargando && styles.botonDeshabilitado]}
                onPress={onRestablecer}
                disabled={cargando}>
                {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Cambiar contraseña</Text>}
              </Pressable>
              <Pressable onPress={onEnviarCodigo} disabled={cargando} style={styles.reenviar}>
                <Text style={styles.reenviarTexto}>Reenviar código</Text>
              </Pressable>
            </>
          )}

          <View style={styles.linkFila}>
            <Text style={styles.linkTexto}>¿Te acordaste? </Text>
            <Link href="/login" style={styles.link}>
              Volver a ingresar
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
    title: { fontSize: 26, fontWeight: '800', marginBottom: 4, textAlign: 'center', color: colors.purple700 },
    sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
    bold: { fontWeight: '800', color: colors.text },
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
    boton: { backgroundColor: colors.purple, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    botonDeshabilitado: { opacity: 0.6 },
    botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
    reenviar: { alignItems: 'center', paddingVertical: 8 },
    reenviarTexto: { color: colors.purple, fontWeight: '700', fontSize: 13 },
    linkFila: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
    linkTexto: { color: colors.textMuted },
    link: { color: colors.purple, fontWeight: '700' },
  });
