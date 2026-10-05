import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCronometroCtx } from '@/components/cronometro-provider';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { spacing, type Tema } from '@/constants/theme';
import { usePremium } from '@/hooks/usePremium';
import { esperadosHoy, semanalesHoy } from '@/lib/data';
import { hoyISO } from '@/logic/fecha';
import { formatearMinutos } from '@/logic/hoy';

const mmss = (s: number) => {
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
};

type ItemCrono = { id: string; nombre: string; valor: number; meta: number; semanal: boolean };

export default function CronometrosScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { esPremium, cargando } = usePremium();
  const { activo, segundos } = useCronometroCtx();
  const hoy = hoyISO();

  // Es feature Premium: sin premium, al paywall.
  useEffect(() => {
    if (!cargando && !esPremium) router.replace('/premium');
  }, [cargando, esPremium]);

  const { data: esperados } = useQuery({
    queryKey: ['esperados-hoy', hoy],
    queryFn: () => esperadosHoy(),
  });
  const { data: semanales } = useQuery({
    queryKey: ['semanales-hoy', hoy],
    queryFn: () => semanalesHoy(),
  });

  const items: ItemCrono[] = [
    ...(esperados ?? [])
      .filter((o) => o.tipo === 'DURATION' && !o.omitido)
      .map((o) => ({ id: o.id_objetivo, nombre: o.nombre, valor: o.valor ?? 0, meta: o.meta_valor ?? 0, semanal: false })),
    ...(semanales ?? [])
      .filter((s) => s.tipo === 'DURATION')
      .map((s) => ({ id: s.id_objetivo, nombre: s.nombre, valor: s.hechos, meta: s.meta ?? 0, semanal: true })),
  ];

  const abrir = (it: ItemCrono) =>
    router.push({
      pathname: '/cronometro/[id]',
      params: { id: it.id, fecha: hoy, nombre: it.nombre, meta: String(it.meta), semanal: it.semanal ? '1' : '0' },
    });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.h1}>Cronómetros</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Tus objetivos con tiempo. Tocá "Activar" para concentrarte con el cronómetro.</Text>

        {items.length === 0 ? (
          <EstadoMensaje
            conDragon
            titulo="No tenés objetivos con cronómetro"
            subtitulo="Creá un objetivo de tipo Duración (por día o por semana) para usarlos acá."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((it) => {
              const activoEste = activo?.id === it.id;
              const valorVivo = activoEste ? it.valor + segundos / 60 : it.valor;
              const progreso = it.meta > 0 ? Math.min(1, valorVivo / it.meta) : 0;
              return (
                <Card key={`${it.id}-${it.semanal}`} style={styles.item}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombre}>{it.nombre}</Text>
                      <Text style={styles.meta}>
                        {formatearMinutos(valorVivo)} / {formatearMinutos(it.meta)}
                        {it.semanal ? ' · por semana' : ''}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.btn, activoEste && styles.btnOn]}
                      onPress={() => abrir(it)}>
                      <Ionicons name={activoEste ? 'stop' : 'play'} size={15} color={activoEste ? '#fff' : colors.purple} />
                      <Text style={[styles.btnText, activoEste && { color: '#fff' }]}>
                        {activoEste ? mmss(segundos) : 'Activar'}
                      </Text>
                    </Pressable>
                  </View>
                  <ProgressBar progress={progreso} color={colors.purple} />
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
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
      paddingBottom: 4,
    },
    h1: { fontSize: 18, fontWeight: '800', color: colors.text },
    scroll: { padding: spacing.lg, gap: 14, paddingBottom: 40 },
    intro: { fontSize: 13, color: colors.textMuted },
    item: { gap: 10 },
    itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    nombre: { fontSize: 15, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      minWidth: 92,
      justifyContent: 'center',
    },
    btnOn: { backgroundColor: colors.purple, borderColor: colors.purple },
    btnText: { fontSize: 13.5, fontWeight: '800', color: colors.purple },
  });
