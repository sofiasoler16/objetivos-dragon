import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrganizarSemanaModal } from '@/components/OrganizarSemanaModal';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { spacing, type Tema } from '@/constants/theme';
import { eventosDeLaSemana } from '@/lib/data';
import { fechaLarga, hoyISO, inicioSemanaISO, sumarDiasISO } from '@/logic/fecha';
import { nombreDia, rangoHorario } from '@/logic/agenda';

export default function AgendaScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const [iaAbierta, setIaAbierta] = useState(false);
  const [lunesISO, setLunesISO] = useState(() => inicioSemanaISO(hoyISO()));

  const semanaActual = lunesISO === inicioSemanaISO(hoyISO());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agenda-semana', lunesISO],
    queryFn: () => eventosDeLaSemana(false, lunesISO),
  });

  const conectar = useMutation({
    mutationFn: () => eventosDeLaSemana(true, lunesISO),
    onSuccess: (res) => {
      queryClient.setQueryData(['agenda-semana', lunesISO], res);
      if (res.motivo === 'sin-permiso')
        Alert.alert(
          'Permiso denegado',
          'Activá el acceso al calendario en los ajustes del teléfono para ver tus eventos.',
        );
    },
  });

  const sinPermiso = data?.motivo === 'sin-permiso';
  const totalItems = data?.dias.reduce((n, d) => n + d.items.length, 0) ?? 0;
  const finSemana = sumarDiasISO(lunesISO, 6);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.h1}>Mi semana</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Navegación de semanas */}
      <View style={styles.semanaNav}>
        <Pressable onPress={() => setLunesISO((l) => sumarDiasISO(l, -7))} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.purple} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.semanaRango}>
            {Number(lunesISO.slice(8))} – {Number(finSemana.slice(8))} de {mesDe(finSemana)}
          </Text>
          {!semanaActual && (
            <Pressable onPress={() => setLunesISO(inicioSemanaISO(hoyISO()))} hitSlop={6}>
              <Text style={styles.volverHoy}>Volver a esta semana</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => setLunesISO((l) => sumarDiasISO(l, 7))} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.purple} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.iaBtn} onPress={() => setIaAbierta(true)}>
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={styles.iaBtnText}>Organizá mi semana con la IA</Text>
        </Pressable>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}

        {isError && (
          <EstadoMensaje
            titulo="No pudimos leer tu calendario"
            subtitulo="Intentá de nuevo en un momento."
            onReintentar={() => refetch()}
          />
        )}

        {sinPermiso && (
          <Card style={{ gap: 12, alignItems: 'flex-start' }}>
            <Text style={styles.h2}>Conectá tu calendario</Text>
            <Text style={styles.muted}>
              Mostramos los eventos del calendario de tu teléfono (incluye los de Google que ya se
              sincronizan). Así la IA no superpone lo que agenda.
            </Text>
            <Pressable
              style={styles.conectarBtn}
              onPress={() => conectar.mutate()}
              disabled={conectar.isPending}>
              <Text style={styles.conectarBtnText}>
                {conectar.isPending ? 'Conectando…' : 'Conectar calendario'}
              </Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && totalItems === 0 && !sinPermiso && (
          <EstadoMensaje
            conDragon
            titulo="Semana despejada"
            subtitulo="No hay nada agendado esta semana."
          />
        )}

        {!isLoading &&
          totalItems > 0 &&
          data!.dias.map((dia) => (
            <View key={dia.fechaISO} style={styles.diaBloque}>
              <View style={styles.diaHeader}>
                <Text style={[styles.diaNombre, dia.esHoy && styles.diaHoy]}>
                  {dia.esHoy ? 'Hoy' : nombreDia(dia.fechaISO)}
                </Text>
                <Text style={styles.diaFecha}>{fechaLarga(dia.fechaISO)}</Text>
              </View>

              {dia.items.length === 0 ? (
                <Text style={styles.sinEventos}>Sin nada agendado</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {dia.items.map((e) => (
                    <Card key={e.id} style={styles.eventoRow}>
                      <View style={[styles.puntito, { backgroundColor: e.color ?? colors.purple }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.tituloRow}>
                          <Text style={styles.eventoTitulo}>{e.titulo}</Text>
                          {e.esApp && (
                            <View style={styles.tag}>
                              <Text style={styles.tagText}>🐉 objetivo</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.muted}>
                          {rangoHorario(e)}
                          {e.ubicacion ? ` · ${e.ubicacion}` : ''}
                        </Text>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          ))}
      </ScrollView>

      <OrganizarSemanaModal visible={iaAbierta} onClose={() => setIaAbierta(false)} />
    </SafeAreaView>
  );
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const mesDe = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];

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
    semanaNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 6,
    },
    navBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    semanaRango: { fontSize: 15, fontWeight: '800', color: colors.text },
    volverHoy: { fontSize: 12, color: colors.purple, fontWeight: '700', marginTop: 2 },
    scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
    h1: { fontSize: 20, fontWeight: '800', color: colors.text },
    h2: { fontSize: 16, fontWeight: '800', color: colors.text },
    muted: { fontSize: 12.5, color: colors.textMuted },
    iaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 13,
    },
    iaBtnText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
    conectarBtn: {
      backgroundColor: colors.purple,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    conectarBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    diaBloque: { gap: 8 },
    diaHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    diaNombre: { fontSize: 16, fontWeight: '800', color: colors.text },
    diaHoy: { color: colors.purple },
    diaFecha: { fontSize: 12, color: colors.textMuted },
    sinEventos: { fontSize: 12.5, color: colors.textMuted, fontStyle: 'italic' },
    eventoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    puntito: { width: 10, height: 10, borderRadius: 5 },
    tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    eventoTitulo: { fontSize: 14.5, color: colors.text, fontWeight: '600' },
    tag: { backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    tagText: { fontSize: 10.5, color: colors.textMuted, fontWeight: '700' },
  });
