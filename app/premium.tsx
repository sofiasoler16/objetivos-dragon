import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { spacing, type Tema } from '@/constants/theme';
import { usePremium } from '@/hooks/usePremium';
import {
  comprarPaquete,
  comprasDisponibles,
  fueCancelada,
  obtenerOfertas,
  restaurarCompras,
  type PaqueteCompra,
} from '@/lib/compras';

const BENEFICIOS = [
  { icon: '🗓️', titulo: 'Mi semana + IA', sub: 'Organizá tu semana y dejá que la IA la arme por vos (150 consultas/mes).' },
  { icon: '📊', titulo: 'Grillas anuales de progreso', sub: 'Mirá todo el año de cada hábito de un vistazo.' },
  { icon: '📈', titulo: 'Estadísticas e insights', sub: 'Tu mejor día, rachas y qué mejorar — personalizado para vos.' },
  { icon: '⏱️', titulo: 'Cronómetro de objetivos', sub: 'Cronometrá tus objetivos de tiempo (leer, estudiar, meditar…).' },
  { icon: '🗄️', titulo: 'Historial de todo el año', sub: 'Guardamos tu progreso del año completo (gratis: últimos 3 meses).' },
  { icon: '🐉', titulo: 'Dragones y temas exclusivos', sub: 'Desbloqueá dragones y colores Premium.' },
];

export default function PremiumScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();
  const { esPremium } = usePremium();

  const { data: ofertas, isLoading: cargandoOfertas } = useQuery({
    queryKey: ['ofertas-premium'],
    queryFn: obtenerOfertas,
  });

  const hayCobro = comprasDisponibles() && (ofertas?.length ?? 0) > 0;
  const [planId, setPlanId] = useState<string | null>(null);

  // Selección por defecto cuando llegan las ofertas (decisión de la usuaria 2026-09-09):
  // pre-seleccionar el MENSUAL (barrera de entrada más baja para empezar la prueba). Si no
  // hubiera mensual, cae a una oferta con prueba, luego la anual, y por último la primera.
  useEffect(() => {
    if (!ofertas?.length) return;
    const preferido =
      ofertas.find((o) => o.tipo === 'mensual') ??
      ofertas.find((o) => o.pruebaGratis) ??
      ofertas.find((o) => o.tipo === 'anual') ??
      ofertas[0];
    setPlanId((prev) => prev ?? preferido.id);
  }, [ofertas]);

  // ¿Alguna oferta trae prueba gratis? (para el banner de promo).
  const hayPrueba = (ofertas ?? []).some((o) => o.pruebaGratis);

  const seleccionado = ofertas?.find((o) => o.id === planId) ?? null;

  // Resumen claro de qué se le cobra según el plan elegido (y qué pasa cuando termina la prueba).
  const cadencia = seleccionado?.tipo === 'anual' ? 'por año' : seleccionado?.tipo === 'mensual' ? 'por mes' : '';
  const resumenCobro = !seleccionado
    ? null
    : seleccionado.pruebaGratis
      ? `Gratis por 14 días. Cuando termina, se cobra ${seleccionado.precio} ${cadencia} salvo que canceles antes.`
      : `Se cobra ${seleccionado.precio} ${cadencia}.`;

  // Al comprar/activar: desbloquea la UI al instante (el webhook confirma en el server) y refresca todo.
  function desbloquear() {
    qc.setQueryData(['premium'], true);
    for (const k of [['premium'], ['coleccion'], ['tema-activo'], ['dragon-equipado']])
      qc.invalidateQueries({ queryKey: k });
  }

  const comprar = useMutation({
    mutationFn: async (pkg: PaqueteCompra) => comprarPaquete(pkg.raw),
    onSuccess: (ok) => {
      if (!ok) return;
      desbloquear();
      Alert.alert('¡Listo! 👑', 'Ya tenés Premium. ¡Disfrutá tu dragón!');
      router.back();
    },
    onError: (e) => {
      if (fueCancelada(e)) return; // el usuario canceló, no es error
      Alert.alert('No se pudo completar la compra', e instanceof Error ? e.message : 'Intentá de nuevo.');
    },
  });

  const restaurar = useMutation({
    mutationFn: restaurarCompras,
    onSuccess: (ok) => {
      if (ok) {
        desbloquear();
        Alert.alert('Compras restauradas', 'Tu Premium quedó activo de nuevo 👑');
      } else {
        Alert.alert('Sin compras previas', 'No encontramos una suscripción activa en esta cuenta.');
      }
    },
    onError: () => Alert.alert('Error', 'No se pudieron restaurar las compras.'),
  });

  const procesando = comprar.isPending || restaurar.isPending;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.corona}>
          <Text style={{ fontSize: 44 }}>👑</Text>
        </View>
        <Text style={styles.h1}>Drakostone Premium</Text>
        <Text style={styles.sub}>Desbloqueá todo el potencial de tu dragón.</Text>

        {!esPremium && hayPrueba && (
          <View style={styles.promoBanner}>
            <Text style={styles.promoIcon}>🎁</Text>
            <Text style={styles.promoText}>
              Probá <Text style={styles.promoBold}>14 días gratis</Text>. Cancelás cuando quieras.
            </Text>
          </View>
        )}

        <Card style={styles.beneficios}>
          {BENEFICIOS.map((b, i) => (
            <View key={b.titulo} style={[styles.benefRow, i === BENEFICIOS.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.benefIcon}>{b.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefTitulo}>{b.titulo}</Text>
                <Text style={styles.benefSub}>{b.sub}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            </View>
          ))}
        </Card>

        {esPremium ? (
          <View style={styles.yaPremium}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <Text style={styles.yaPremiumText}>Ya tenés Premium 👑</Text>
          </View>
        ) : hayCobro ? (
          // ── Cobro real (RevenueCat) ──────────────────────────────────────────
          <>
            {ofertas!.map((o) => (
              <Pressable
                key={o.id}
                style={[styles.plan, planId === o.id && styles.planSel]}
                onPress={() => setPlanId(o.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitulo}>{o.tipo === 'anual' ? 'Anual' : o.tipo === 'mensual' ? 'Mensual' : 'Plan'}</Text>
                  <Text style={styles.planSub}>
                    {o.precio}
                    {o.tipo === 'anual' ? ' por año' : o.tipo === 'mensual' ? ' por mes' : ''}
                    {o.pruebaGratis ? ' · 14 días gratis' : ''}
                  </Text>
                </View>
                {o.tipo === 'anual' && (
                  <View style={styles.ahorro}>
                    <Text style={styles.ahorroText}>MÁS BARATO</Text>
                  </View>
                )}
              </Pressable>
            ))}

            <Pressable
              style={[styles.cta, procesando && { opacity: 0.6 }]}
              disabled={!seleccionado || procesando}
              onPress={() => seleccionado && comprar.mutate(seleccionado)}>
              {comprar.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {seleccionado?.pruebaGratis ? 'Comenzar prueba gratis' : 'Suscribirme'}
                </Text>
              )}
            </Pressable>

            {resumenCobro && <Text style={styles.resumenCobro}>{resumenCobro}</Text>}

            <Pressable onPress={() => restaurar.mutate()} disabled={procesando} style={styles.restaurarBtn}>
              <Text style={styles.restaurarText}>Restaurar compras</Text>
            </Pressable>

            <Text style={styles.nota}>
              Se cobra a través de Google Play y la suscripción se renueva sola hasta que la canceles.
              Para cancelar: abrí Google Play → tu foto de perfil → Pagos y suscripciones → Suscripciones →
              Drakostone → Cancelar. Si cancelás durante la prueba gratis, no se te cobra nada.
            </Text>
          </>
        ) : cargandoOfertas ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.purple} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 8 },
    scroll: { padding: spacing.lg, gap: 14, paddingBottom: 40, alignItems: 'stretch' },
    corona: { alignSelf: 'center', marginTop: 8 },
    h1: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
    sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: -6 },
    promoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.green + '1a',
      borderWidth: 1,
      borderColor: colors.green + '55',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    promoIcon: { fontSize: 22 },
    promoText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 19 },
    promoBold: { fontWeight: '800', color: colors.green700 },
    beneficios: { gap: 0, marginTop: 6 },
    benefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    benefIcon: { fontSize: 22 },
    benefTitulo: { fontSize: 15, fontWeight: '700', color: colors.text },
    benefSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 2,
      borderColor: colors.divider,
      borderRadius: 16,
      padding: 16,
    },
    planSel: { borderColor: colors.purple, backgroundColor: colors.purple + '10' },
    planTitulo: { fontSize: 16, fontWeight: '800', color: colors.text },
    planSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    ahorro: { backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    ahorroText: { fontSize: 10.5, fontWeight: '800', color: '#fff' },
    cta: { backgroundColor: colors.purple, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    restaurarBtn: { alignItems: 'center', paddingVertical: 8 },
    restaurarText: { fontSize: 13, color: colors.purple, fontWeight: '700' },
    resumenCobro: {
      fontSize: 13,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 18,
      fontWeight: '600',
      marginTop: 2,
    },
    nota: { fontSize: 11.5, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
    yaPremium: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
    yaPremiumText: { fontSize: 17, fontWeight: '800', color: colors.text },
  });
