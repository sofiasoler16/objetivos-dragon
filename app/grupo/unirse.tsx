import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/theme-provider';
import { spacing, type Tema } from '@/constants/theme';
import { infoInvitacion, unirsePorCodigo } from '@/lib/data';

export default function UnirseGrupoScreen() {
  const params = useLocalSearchParams<{ codigo?: string }>();
  const colors = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();

  const [codigo, setCodigo] = useState((params.codigo ?? '').toString().toUpperCase());
  const codigoOk = codigo.trim().length >= 6;

  // Vista previa de a qué grupo te unís (nombre, ícono, y si el link es para tomar un lugar).
  const { data: info, isFetching } = useQuery({
    queryKey: ['info-invitacion', codigo.trim().toUpperCase()],
    queryFn: () => infoInvitacion(codigo.trim()),
    enabled: codigoOk,
  });

  const unirse = useMutation({
    mutationFn: () => unirsePorCodigo(codigo.trim()),
    onSuccess: (idGrupo) => {
      qc.invalidateQueries({ queryKey: ['mis-grupos'] });
      router.replace(`/grupo/${idGrupo}`);
    },
    onError: (e) => Alert.alert('No se pudo unir', e instanceof Error ? e.message : 'Revisá el código.'),
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.titulo}>Unirte a un grupo</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Código de invitación</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 3F9A2B7C"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          value={codigo}
          onChangeText={(t) => setCodigo(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
          maxLength={12}
        />

        {codigoOk && isFetching && <ActivityIndicator style={{ marginTop: 16 }} color={colors.purple} />}

        {codigoOk && !isFetching && info === null && (
          <Text style={styles.invalido}>Ese código no es válido o venció.</Text>
        )}

        {info && (
          <View style={styles.previa}>
            <Text style={{ fontSize: 40 }}>{info.grupo_icono ?? '👥'}</Text>
            <Text style={styles.previaNombre}>{info.grupo_nombre}</Text>
            {info.destino_nombre && (
              <Text style={styles.previaDestino}>Vas a tomar el lugar de “{info.destino_nombre}”</Text>
            )}
            <Pressable
              style={[styles.btnPrimary, unirse.isPending && { opacity: 0.6 }]}
              onPress={() => unirse.mutate()}
              disabled={unirse.isPending}>
              {unirse.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Unirme al grupo</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: 8,
      paddingBottom: 6,
    },
    titulo: { fontSize: 18, fontWeight: '800', color: colors.text },
    body: { padding: spacing.lg, gap: 8 },
    label: { fontSize: 12.5, color: colors.textMuted, fontWeight: '700' },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 18,
      letterSpacing: 3,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlign: 'center',
      fontWeight: '700',
    },
    invalido: { color: colors.red, fontSize: 13.5, textAlign: 'center', marginTop: 14, fontWeight: '600' },
    previa: { alignItems: 'center', gap: 8, marginTop: 24 },
    previaNombre: { fontSize: 20, fontWeight: '800', color: colors.text },
    previaDestino: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center' },
    btnPrimary: {
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 14,
      paddingHorizontal: 40,
      alignItems: 'center',
      marginTop: 12,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
