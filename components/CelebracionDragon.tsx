import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DragonMascot } from '@/components/DragonMascot';
import { useTheme } from '@/components/theme-provider';
import { radius, spacing, type Tema } from '@/constants/theme';
import { usePremium } from '@/hooks/usePremium';
import { cargarColeccion, comprarDragon, equiparDragon } from '@/lib/data';
import { estadoColeccion } from '@/logic/dragones';

// Un dragón para celebrar: recién desbloqueado (logro, ya en tu colección) o reclamable (premium gratis).
export type Celebracion = {
  idDragon: string;
  assetKey: string;
  nombre: string;
  idTema: string | null;
  tipo: 'desbloqueado' | 'reclamable';
  logro?: string; // nombre del logro que lo regaló (si vino por un logro)
};

// Pub/sub para disparar una celebración desde cualquier lado (ej. al desbloquear un logro).
let emitir: ((c: Celebracion) => void) | null = null;
export function celebrarDragon(c: Celebracion): void {
  emitir?.(c);
}

// Set (en el teléfono) de dragones ya celebrados, para no repetir el aviso.
const CLAVE = 'dragones_celebrados_v1';
async function leerCelebrados(): Promise<Set<string>> {
  try {
    return new Set(JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? '[]'));
  } catch {
    return new Set();
  }
}
async function marcarCelebrado(id: string): Promise<void> {
  const s = await leerCelebrados();
  s.add(id);
  await AsyncStorage.setItem(CLAVE, JSON.stringify([...s]));
}

export function CelebracionDragon() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const queryClient = useQueryClient();
  const { esPremium } = usePremium();
  const [cola, setCola] = useState<Celebracion[]>([]);
  const [listo, setListo] = useState(false);
  const celebrados = useRef<Set<string>>(new Set());

  const { data } = useQuery({ queryKey: ['coleccion'], queryFn: cargarColeccion });

  useEffect(() => {
    leerCelebrados().then((s) => {
      celebrados.current = s;
      setListo(true);
    });
    emitir = (c) => setCola((q) => (q.some((x) => x.idDragon === c.idDragon) ? q : [...q, c]));
    return () => {
      emitir = null;
    };
  }, []);

  // Vigía: dragones PREMIUM gratis que ya podés reclamar (con Premium) y no celebraste aún.
  useEffect(() => {
    if (!data || !listo) return;
    const stats = data.stats ?? { nivel: 1, xp_total: 0, creditos: 0 };
    const logros = new Set(data.logrosDesbloqueados ?? []);
    for (const d of data.dragones) {
      if (!d.premium_required || d.credit_cost !== 0) continue;
      const estado = estadoColeccion(d, stats, esPremium, logros);
      if (estado !== 'disponible') continue; // 'disponible' = con Premium y sin reclamar
      if (celebrados.current.has(`reclamable:${d.id_dragon}`)) continue;
      setCola((q) =>
        q.some((x) => x.idDragon === d.id_dragon)
          ? q
          : [...q, { idDragon: d.id_dragon, assetKey: d.asset_key, nombre: d.nombre, idTema: d.id_tema, tipo: 'reclamable' }],
      );
    }
  }, [data, esPremium, listo]);

  const actual = cola[0];

  const refrescar = () => {
    for (const k of [['coleccion'], ['perfil-stats'], ['dragon-equipado'], ['tema-activo']])
      queryClient.invalidateQueries({ queryKey: k });
  };

  // Cierra la celebración actual. Actualiza `celebrados` en el acto (sincrónico) para que el vigía
  // no la vuelva a encolar tras el refetch de la colección, y saca la tarjeta de la cola.
  const cerrar = () => {
    if (actual) {
      const clave = `${actual.tipo}:${actual.idDragon}`;
      celebrados.current.add(clave);
      marcarCelebrado(clave).catch(() => {}); // persistir sin bloquear
    }
    setCola((q) => q.slice(1));
  };

  const reclamar = useMutation({
    mutationFn: async () => {
      await comprarDragon(actual!.idDragon); // premium gratis: costo 0
      await equiparDragon(actual!.idDragon, actual!.idTema);
    },
    onSuccess: () => {
      cerrar(); // primero saco la tarjeta (y marco celebrado) para que no reaparezca
      refrescar();
    },
  });

  const equipar = useMutation({
    mutationFn: () => equiparDragon(actual!.idDragon, actual!.idTema),
    onSuccess: () => {
      cerrar();
      refrescar();
    },
  });

  if (!actual) return null;
  const esReclamable = actual.tipo === 'reclamable';
  const cargando = reclamar.isPending || equipar.isPending;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cerrar}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>{esReclamable ? '👑 Dragón Premium' : '¡Nuevo dragón! 🎉'}</Text>
          <View style={styles.art}>
            <DragonMascot assetKey={actual.assetKey} size={150} />
          </View>
          <Text style={styles.nombre}>{actual.nombre}</Text>
          <Text style={styles.texto}>
            {esReclamable
              ? `Podés reclamar el dragón ${actual.nombre}.`
              : actual.logro
                ? `¡Ganaste el dragón ${actual.nombre} por el logro «${actual.logro}»!`
                : `Desbloqueaste el dragón ${actual.nombre}.`}
          </Text>

          <Pressable
            style={styles.btn}
            disabled={cargando}
            onPress={() => (esReclamable ? reclamar.mutate() : equipar.mutate())}>
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{esReclamable ? 'Reclamar y equipar' : 'Equipar'}</Text>
            )}
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={cerrar} disabled={cargando}>
            <Text style={styles.btnGhostText}>Después</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Tema) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(36,31,56,0.55)', justifyContent: 'center', padding: spacing.xl },
    card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: 8 },
    titulo: { fontSize: 18, fontWeight: '800', color: colors.text },
    art: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
    nombre: { fontSize: 20, fontWeight: '800', color: colors.text },
    texto: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    btn: {
      marginTop: 8,
      alignSelf: 'stretch',
      backgroundColor: colors.purple,
      borderRadius: radius.pill,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    btnGhost: { alignSelf: 'stretch', paddingVertical: 10, alignItems: 'center' },
    btnGhostText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  });
