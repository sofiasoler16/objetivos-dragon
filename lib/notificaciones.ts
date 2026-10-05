// Puente con expo-notifications (API del sistema). La lógica de QUÉ recordar está
// en logic/recordatorios.ts; acá solo se traduce y se habla con el SO.
// Nota: en Expo Go (SDK 53+) el soporte es limitado; las notificaciones locales
// programadas suelen andar, pero lo 100% garantizado es con un development build.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { Disparador, Recordatorio } from '@/logic/recordatorios';

let configurado = false;

/** Configura el handler (mostrar en foreground) y el canal de Android. Idempotente. */
export async function configurarNotificaciones(): Promise<void> {
  if (configurado) return;
  configurado = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    // Importancia ALTA para que lleguen a tiempo (heads-up). Ojo: Android congela la importancia de
    // un canal ya creado → esto aplica del todo en una instalación nueva (rebuild).
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

/** Pide permiso de notificaciones (si no lo tiene ya). Devuelve si quedó concedido. */
export async function pedirPermisoNotificaciones(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const solicitado = await Notifications.requestPermissionsAsync();
  return solicitado.status === 'granted';
}

/**
 * Obtiene el token de push de Expo de este dispositivo (para notificaciones push del servidor,
 * ej. "te asignaron una tarea"). Devuelve null si no hay permiso o no se pudo (best-effort).
 * Solo funciona en un dispositivo real con development/production build (no en Expo Go / emulador).
 */
let ultimoPushToken: string | null = null;

export async function obtenerPushToken(): Promise<string | null> {
  if (ultimoPushToken) return ultimoPushToken;
  try {
    await configurarNotificaciones();
    const permitido = await pedirPermisoNotificaciones();
    if (!permitido) return null;
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    ultimoPushToken = res.data ?? null;
    return ultimoPushToken;
  } catch {
    return null;
  }
}

/** El token ya obtenido en esta sesión (sin ir a la red). Para limpiarlo al cerrar sesión. */
export function pushTokenEnMemoria(): string | null {
  return ultimoPushToken;
}

/** Traduce un disparador neutro al trigger de expo. Weekday de expo: 1=domingo..7=sábado. */
function aTrigger(d: Disparador): Notifications.SchedulableNotificationTriggerInput {
  switch (d.tipo) {
    case 'diario':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: d.hora, minute: d.minuto };
    case 'semanal':
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: (d.isoDow % 7) + 1, // ISO 1..7 (lun..dom) → expo 1..7 (dom..sáb)
        hour: d.hora,
        minute: d.minuto,
      };
    case 'fecha':
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(d.anio, d.mes - 1, d.dia, d.hora, d.minuto),
      };
  }
}

/**
 * Reconciliación: cancela TODO lo programado por la app y reprograma desde cero
 * con los recordatorios actuales. Simple y correcto (evita duplicados/huérfanos).
 * Solo pide permiso si hay algo para programar.
 */
export async function sincronizarRecordatorios(recordatorios: Recordatorio[]): Promise<void> {
  await configurarNotificaciones();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (recordatorios.length === 0) return;

  const permitido = await pedirPermisoNotificaciones();
  if (!permitido) return;

  const ahora = Date.now();
  for (const r of recordatorios) {
    // Una fecha puntual ya pasada rompe el schedule → saltear.
    if (r.disparador.tipo === 'fecha') {
      const cuando = new Date(
        r.disparador.anio,
        r.disparador.mes - 1,
        r.disparador.dia,
        r.disparador.hora,
        r.disparador.minuto,
      );
      if (cuando.getTime() <= ahora) continue;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: r.titulo, body: r.cuerpo },
      trigger: aTrigger(r.disparador),
    });
  }
}

/** Programa una notificación de prueba en 5 segundos. Devuelve si hubo permiso. */
export async function notificacionDePrueba(): Promise<boolean> {
  await configurarNotificaciones();
  const permitido = await pedirPermisoNotificaciones();
  if (!permitido) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🐉 ¡Recordatorio de prueba!',
      body: 'Si ves esto, las notificaciones funcionan.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
  });
  return true;
}

/**
 * Abre los ajustes de "optimización de batería" del sistema (Android), donde el usuario puede
 * marcar la app como "Sin restricciones"/"Permitir siempre" para que los recordatorios lleguen a
 * tiempo aunque el teléfono esté dormido (Doze). No requiere permiso especial.
 */
export async function abrirAjustesBateria(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    try {
      await Linking.openSettings(); // fallback: ajustes de la app
    } catch {
      /* nada más que hacer */
    }
  }
}
