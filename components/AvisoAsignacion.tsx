import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { misMembresias, suscribirAsignaciones } from '@/lib/data';

/** Muestra un aviso breve (toast en Android, alerta en iOS). */
function mostrarAviso(mensaje: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(mensaje, ToastAndroid.LONG, ToastAndroid.TOP);
  } else {
    Alert.alert('Nueva asignación 🐉', mensaje);
  }
}

/**
 * Componente invisible: escucha EN VIVO (Supabase Realtime) cuando te asignan una tarea/objetivo
 * en algún grupo y te muestra un aviso, sin necesidad de push/FCM. Solo funciona con la app abierta.
 * Se monta una vez dentro del área logueada (layout de tabs).
 */
export function AvisoAsignacion() {
  const qc = useQueryClient();
  const { data: membresias } = useQuery({ queryKey: ['mis-membresias'], queryFn: misMembresias });

  useEffect(() => {
    if (!membresias || membresias.length === 0) return;
    const mios = new Map(membresias.map((m) => [m.id_miembro, m.grupo_nombre]));

    const cortar = suscribirAsignaciones((fila, anterior) => {
      const asignado = fila.id_miembro_asignado;
      if (!asignado || !mios.has(asignado)) return; // no es para mí
      if (anterior === asignado) return; // edición que no cambió la asignación
      const grupo = mios.get(asignado)!;
      const tipoTxt = fila.tipo === 'OBJETIVO' ? 'un objetivo' : 'una tarea';
      mostrarAviso(`Te asignaron ${tipoTxt}: ${fila.titulo} · en ${grupo}`);
      // Refrescar las vistas del grupo por si están abiertas.
      qc.invalidateQueries({ queryKey: ['esperados-grupo'] });
      qc.invalidateQueries({ queryKey: ['semanales-grupo'] });
      qc.invalidateQueries({ queryKey: ['progreso-grupo'] });
      qc.invalidateQueries({ queryKey: ['items-hoy-grupos'] });
    });

    return cortar;
  }, [membresias, qc]);

  return null;
}
