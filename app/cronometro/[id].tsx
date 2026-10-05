import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCronometroCtx } from '@/components/cronometro-provider';
import { useTheme } from '@/components/theme-provider';
import { spacing, type Tema } from '@/constants/theme';
import { esperadosHoy, type SemanalHoy, semanalesHoy } from '@/lib/data';
import { hoyISO } from '@/logic/fecha';
import { type EsperadoHoy, formatearMinutos } from '@/logic/hoy';

const TAM = 260; // diámetro del círculo

/** MM:SS (o H:MM:SS) de la sesión en curso. */
function mmss(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(seg).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function CronometroScreen() {
  const params = useLocalSearchParams<{
    id: string;
    fecha?: string;
    nombre?: string;
    meta?: string;
    semanal?: string;
  }>();
  const id = params.id;
  const fecha = params.fecha ?? hoyISO();
  const nombre = params.nombre ?? 'Objetivo';
  const meta = Number(params.meta) || 0;
  const semanal = params.semanal === '1';

  const colors = useTheme();
  const styles = makeStyles(colors);
  const { activo, segundos, iniciar, detener } = useCronometroCtx();

  const corriendo = activo?.id === id;
  const seg = corriendo ? segundos : 0;

  // Valor ya acumulado (base) para arrancar el círculo desde ahí: día (valor) o semana (suma).
  const fechaArg = fecha === hoyISO() ? undefined : fecha;
  const { data } = useQuery<(EsperadoHoy | SemanalHoy)[]>({
    queryKey: semanal ? ['semanales-hoy', fecha] : ['esperados-hoy', fecha],
    queryFn: async () => (semanal ? semanalesHoy(undefined, fechaArg) : esperadosHoy(undefined, fechaArg)),
  });
  const fila = data?.find((x) => x.id_objetivo === id);
  const baseValor = semanal
    ? ((fila as SemanalHoy | undefined)?.hechos ?? 0)
    : ((fila as EsperadoHoy | undefined)?.valor ?? 0);

  const totalVivo = baseValor + seg / 60;
  const progreso = meta > 0 ? Math.min(1, totalVivo / meta) : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.titulo} numberOfLines={1}>
          {nombre}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.centro}>
        {/* Círculo que se LLENA de abajo hacia arriba a medida que avanza el tiempo. */}
        <View style={styles.circulo}>
          <View style={[styles.relleno, { height: `${progreso * 100}%` }]} />
          <View style={styles.circuloContenido}>
            <Text style={styles.tiempo}>{mmss(seg)}</Text>
            <Text style={styles.total}>
              {formatearMinutos(totalVivo)} / {formatearMinutos(meta)}
            </Text>
            <Text style={styles.pct}>{Math.round(progreso * 100)}%</Text>
          </View>
        </View>

        {semanal && <Text style={styles.hint}>Meta de esta semana</Text>}
      </View>

      <View style={styles.acciones}>
        {corriendo ? (
          <Pressable style={[styles.btn, styles.btnStop]} onPress={() => detener()}>
            <Ionicons name="stop" size={20} color="#fff" />
            <Text style={styles.btnText}>Detener y guardar</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, styles.btnStart]}
            onPress={() => iniciar({ id, fecha, nombre, meta, semanal })}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.btnText}>Iniciar</Text>
          </Pressable>
        )}
        <Text style={styles.nota}>
          El cronómetro sigue contando aunque cierres la app. Al detener, se suman los minutos.
        </Text>
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
      gap: 12,
    },
    titulo: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    circulo: {
      width: TAM,
      height: TAM,
      borderRadius: TAM / 2,
      backgroundColor: colors.card,
      borderWidth: 4,
      borderColor: colors.purple,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    relleno: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.purple + '3A', // violeta translúcido que sube
    },
    circuloContenido: { alignItems: 'center', gap: 4 },
    tiempo: { fontSize: 52, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
    total: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
    pct: { fontSize: 13, fontWeight: '800', color: colors.purple, marginTop: 2 },
    hint: { fontSize: 13, color: colors.textMuted },
    acciones: { paddingHorizontal: spacing.lg, paddingBottom: 12, gap: 10 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 999,
      paddingVertical: 16,
    },
    btnStart: { backgroundColor: colors.purple },
    btnStop: { backgroundColor: colors.red },
    btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    nota: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
  });
