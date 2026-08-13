import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { Card } from '@/components/ui/Card';
import { EstadoMensaje } from '@/components/ui/EstadoMensaje';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { radius, spacing, type Tema } from '@/constants/theme';
import {
  cargarColeccion,
  comprarDragon,
  type DragonColeccion,
  equiparDragon,
  listarLogros,
  type LogroConEstado,
} from '@/lib/data';
import {
  estadoColeccion,
  type EstadoColeccion,
  nivelDesdeXp,
  progresoNivel,
  textoRequisito,
  XP_POR_NIVEL,
  xpEnNivel,
} from '@/logic/dragones';

export default function MiDragonScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['coleccion'],
    queryFn: cargarColeccion,
  });
  const { data: logros } = useQuery({ queryKey: ['logros'], queryFn: listarLogros });

  const stats = data?.stats ?? { nivel: 1, xp_total: 0, creditos: 0 };
  const nivel = nivelDesdeXp(stats.xp_total);
  const xpNivel = xpEnNivel(stats.xp_total);
  const progreso = progresoNivel(stats.xp_total);
  const dragones = data?.dragones ?? [];
  const logrosDesbloqueados = new Set(data?.logrosDesbloqueados ?? []);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['coleccion'] });
    queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dragon-equipado'] });
    queryClient.invalidateQueries({ queryKey: ['tema-activo'] }); // repinta la app al equipar
  };

  const equipar = useMutation({
    mutationFn: (d: DragonColeccion) => equiparDragon(d.id_dragon, d.id_tema),
    onSuccess: refrescar,
    onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo equipar.'),
  });

  const comprar = useMutation({
    mutationFn: (d: DragonColeccion) => comprarDragon(d.id_dragon),
    onSuccess: (_r, d) => {
      refrescar();
      Alert.alert('¡Es tuyo! 🎉', `Compraste el dragón ${d.nombre}. ¿Lo equipás ahora?`, [
        { text: 'Después', style: 'cancel' },
        { text: 'Equipar', onPress: () => equipar.mutate(d) },
      ]);
    },
    onError: (e) => Alert.alert('No se pudo comprar', e instanceof Error ? e.message : 'Intentá de nuevo.'),
  });

  const onComprar = (d: DragonColeccion) => {
    if (stats.creditos < d.credit_cost) {
      Alert.alert('Te faltan monedas', `Necesitás ${d.credit_cost - stats.creditos} 🪙 más para el dragón ${d.nombre}.`);
      return;
    }
    Alert.alert('Comprar dragón', `¿Comprar ${d.nombre} por ${d.credit_cost} 🪙?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Comprar', onPress: () => comprar.mutate(d) },
    ]);
  };
  const onEquipar = (d: DragonColeccion) => equipar.mutate(d);
  // esPremium: por ahora false (la suscripción llega más adelante).
  const conEstado = dragones.map((d) => ({
    d,
    estado: estadoColeccion(d, stats, false, logrosDesbloqueados),
  }));

  const coleccion = conEstado.filter((x) => x.estado === 'equipado' || x.estado === 'en_coleccion');
  // el equipado primero
  coleccion.sort((a) => (a.estado === 'equipado' ? -1 : 1));
  const disponibles = conEstado.filter((x) => x.estado === 'disponible');
  const bloqueados = conEstado.filter((x) => x.estado === 'bloqueado');
  const premium = conEstado.filter((x) => x.estado === 'premium');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.h1}>Mi Dragón</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Encabezado: nivel · XP (del nivel) · monedas */}
        <Card style={styles.statsCard}>
          <Stat label="Nivel" valor={String(nivel)} />
          <View style={styles.statDivider} />
          <Stat label="XP" valor={String(xpNivel)} />
          <View style={styles.statDivider} />
          <Stat label="Monedas" valor={`${stats.creditos} 🪙`} />
        </Card>

        {/* Barra de progreso hacia el próximo nivel (se reinicia al subir). */}
        <Card style={{ gap: 8 }}>
          <View style={styles.progRow}>
            <Text style={styles.progLabel}>Progreso al nivel {nivel + 1}</Text>
            <Text style={styles.muted}>
              {xpNivel} / {XP_POR_NIVEL} XP
            </Text>
          </View>
          <ProgressBar progress={progreso} color={colors.purple} />
        </Card>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {isError && (
          <View style={{ marginTop: spacing.lg }}>
            <EstadoMensaje
              titulo="No pudimos cargar tu colección"
              subtitulo="Revisá tu conexión e intentá de nuevo."
              onReintentar={() => refetch()}
            />
          </View>
        )}

        {(['Mi colección', 'Disponibles', 'Bloqueados', 'Premium 👑'] as const).map((titulo, i) => (
          <Grupo
            key={titulo}
            titulo={titulo}
            items={[coleccion, disponibles, bloqueados, premium][i]}
            creditos={stats.creditos}
            onComprar={onComprar}
            onEquipar={onEquipar}
          />
        ))}

        {/* Logros: se desbloquean cumpliendo tu historial (dan XP/monedas). */}
        {logros && logros.length > 0 && (
          <>
            <Text style={styles.grupoTitulo}>Logros 🏆</Text>
            <View style={{ gap: 10 }}>
              {logros.map((l) => (
                <LogroCard key={l.id_logro} logro={l} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LogroCard({ logro }: { logro: LogroConEstado }) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const ok = logro.desbloqueado;
  return (
    <Card style={[styles.logroCard, !ok && { opacity: 0.7 }]}>
      <View style={[styles.logroIcon, ok ? styles.logroIconOk : styles.logroIconOff]}>
        <Ionicons
          name={ok ? 'trophy' : 'lock-closed'}
          size={20}
          color={ok ? colors.green700 : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.logroNombre}>{logro.nombre}</Text>
        {logro.descripcion ? <Text style={styles.logroDesc}>{logro.descripcion}</Text> : null}
        <Text style={styles.logroRecompensa}>
          {ok ? '✓ Desbloqueado · ' : 'Recompensa: '}
          +{logro.xp_reward} XP · +{logro.credit_reward} 🪙
        </Text>
      </View>
    </Card>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.stat}>
      <Text style={styles.statValor}>{valor}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type Handlers = {
  creditos: number;
  onComprar: (d: DragonColeccion) => void;
  onEquipar: (d: DragonColeccion) => void;
};

function Grupo({
  titulo,
  items,
  ...handlers
}: { titulo: string; items: { d: DragonColeccion; estado: EstadoColeccion }[] } & Handlers) {
  const styles = makeStyles(useTheme());
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.grupoTitulo}>{titulo}</Text>
      <View style={{ gap: 12 }}>
        {items.map(({ d, estado }) => (
          <DragonCard key={d.id_dragon} dragon={d} estado={estado} {...handlers} />
        ))}
      </View>
    </>
  );
}

function DragonCard({
  dragon,
  estado,
  ...handlers
}: { dragon: DragonColeccion; estado: EstadoColeccion } & Handlers) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  return (
    <Card style={styles.dragonCard}>
      <View style={[styles.dragonArt, estado === 'bloqueado' && { opacity: 0.5 }]}>
        <DragonMascot assetKey={dragon.asset_key} size={72} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.dragonNombre}>{dragon.nombre}</Text>
          {estado === 'equipado' && (
            <View style={styles.badgeEquipado}>
              <Text style={styles.badgeEquipadoText}>Equipado</Text>
            </View>
          )}
        </View>
        {dragon.descripcion ? <Text style={styles.dragonDesc}>{dragon.descripcion}</Text> : null}
        <View style={{ marginTop: 6 }}>{accion(estado, dragon, handlers, styles, colors)}</View>
      </View>
    </Card>
  );
}

function accion(
  estado: EstadoColeccion,
  dragon: DragonColeccion,
  h: Handlers,
  styles: ReturnType<typeof makeStyles>,
  colors: Tema,
) {
  switch (estado) {
    case 'equipado':
      return <Text style={styles.muted}>Es el dragón que llevás puesto.</Text>;
    case 'en_coleccion':
      return (
        <Pressable style={styles.btnSecundario} onPress={() => h.onEquipar(dragon)}>
          <Text style={styles.btnSecundarioText}>Equipar</Text>
        </Pressable>
      );
    case 'disponible': {
      const alcanza = h.creditos >= dragon.credit_cost;
      return (
        <Pressable
          style={[styles.btnPrimario, !alcanza && styles.btnDeshabilitado]}
          onPress={() => h.onComprar(dragon)}>
          <Ionicons name="cart-outline" size={15} color="#fff" />
          <Text style={styles.btnPrimarioText}>
            {alcanza ? `Comprar · ${dragon.credit_cost} 🪙` : `Faltan ${dragon.credit_cost - h.creditos} 🪙`}
          </Text>
        </Pressable>
      );
    }
    case 'bloqueado':
      return (
        <View style={styles.reqRow}>
          <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
          <Text style={styles.muted}>Se desbloquea con: {textoRequisito(dragon.regla) ?? '—'}</Text>
        </View>
      );
    case 'premium':
      return <Text style={styles.muted}>Requiere Premium 👑</Text>;
  }
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: '800', color: colors.text },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardPurple },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValor: { fontSize: 20, fontWeight: '800', color: colors.purple700 },
  statLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: '700' },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.divider },
  progRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  grupoTitulo: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  dragonCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dragonArt: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: colors.purple100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragonNombre: { fontSize: 16, fontWeight: '800', color: colors.text },
  dragonDesc: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
  muted: { fontSize: 12.5, color: colors.textMuted },
  badgeEquipado: { backgroundColor: colors.green100, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 8 },
  badgeEquipadoText: { fontSize: 10.5, fontWeight: '800', color: colors.green700 },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.purple,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnPrimarioText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  btnDeshabilitado: { opacity: 0.45 },
  btnSecundario: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.purple,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  btnSecundarioText: { color: colors.purple, fontWeight: '800', fontSize: 12.5 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logroCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logroIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logroIconOk: { backgroundColor: colors.green100 },
  logroIconOff: { backgroundColor: colors.purple100 },
  logroNombre: { fontSize: 15, fontWeight: '800', color: colors.text },
  logroDesc: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
  logroRecompensa: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
});
