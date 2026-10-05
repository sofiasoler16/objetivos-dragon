import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { registrarPushToken } from '@/lib/data';
import { obtenerPushToken } from '@/lib/notificaciones';

/**
 * Componente invisible: registra el token de push del dispositivo (para las notificaciones del
 * servidor, ej. "te asignaron una tarea") y, al tocar una de esas notificaciones, abre el grupo.
 * Se monta una vez dentro del área logueada (layout de tabs). Best-effort: si no hay permiso o
 * token, no hace nada.
 */
export function PushSync() {
  useEffect(() => {
    let cancelado = false;
    obtenerPushToken()
      .then((token) => {
        if (!cancelado && token) return registrarPushToken(token);
      })
      .catch((e) => console.warn('No se pudo registrar el push token:', e));
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { tipo?: string; id_grupo?: string };
      if (data?.tipo === 'asignacion_grupo' && data?.id_grupo) {
        router.push(`/grupo/${data.id_grupo}`);
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
