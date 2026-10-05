// Notificación EN VIVO del cronómetro (Android): usa @notifee/react-native para mostrar una
// notificación fija con un cronómetro NATIVO (Android la actualiza solo, aun con la app cerrada).
//
// ⚠️ @notifee es un módulo NATIVO: no está en el dev-client actual → se ve recién en el próximo
// rebuild. Todo acá es BEST-EFFORT y con lazy require + try/catch: si el módulo no está, NO hace
// nada (y NO rompe la app). Solo Android.
import { Platform } from 'react-native';

// undefined = no intentado todavía · null = no disponible · objeto = módulo cargado
let mod: any;
function notif(): any | null {
  if (mod !== undefined) return mod;
  try {
    // require perezoso: si el módulo nativo no está, cae al catch y queda deshabilitado.
    mod = require('@notifee/react-native');
  } catch {
    mod = null;
  }
  return mod;
}

const CANAL = 'cronometro';
const NOTIF_ID = 'cronometro-activo';

/**
 * Muestra (o actualiza) la notificación con el cronómetro nativo en curso.
 * `inicioMs` = momento de arranque; Android cuenta el tiempo desde ahí, en vivo.
 */
export async function mostrarNotifCronometro(nombre: string, inicioMs: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  const m = notif();
  if (!m) return;
  const notifee = m.default;
  const AndroidImportance = m.AndroidImportance;
  try {
    await notifee.requestPermission();
    await notifee.createChannel({ id: CANAL, name: 'Cronómetro', importance: AndroidImportance?.LOW ?? 2 });
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: `⏱️ ${nombre}`,
      body: 'Cronómetro en curso',
      android: {
        channelId: CANAL,
        ongoing: true, // fija: no se descarta deslizando
        onlyAlertOnce: true,
        showChronometer: true, // cronómetro nativo que se actualiza solo
        chronometerDirection: 'up',
        timestamp: inicioMs,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default' }, // tocarla abre la app
      },
    });
  } catch {
    /* best-effort */
  }
}

/** Oculta la notificación del cronómetro (al detener o al no haber ninguno activo). */
export async function ocultarNotifCronometro(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const m = notif();
  if (!m) return;
  try {
    await m.default.cancelNotification(NOTIF_ID);
  } catch {
    /* best-effort */
  }
}
