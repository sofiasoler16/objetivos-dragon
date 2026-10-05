// Puente del widget de Android (react-native-android-widget = NATIVO → se ve recién en el
// dev-build/rebuild). La app guarda un SNAPSHOT liviano de "Hoy" en AsyncStorage cada vez que
// recalcula la pantalla; el widget corre con la app CERRADA y lee ese snapshot (no tiene sesión
// de Supabase). El repintado inmediato (requestWidgetUpdate) es BEST-EFFORT con lazy require +
// try/catch: si el módulo nativo no está (dev-client viejo), no rompe nada.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type WidgetItem = { nombre: string; hecho: boolean };
export type WidgetSnapshot = {
  fecha: string; // yyyy-mm-dd (día del snapshot)
  percent: number; // 0-100 (lo dibuja el widget "Porcentaje"; el de "Hoy" no lo muestra)
  items: WidgetItem[]; // objetivos + tareas de hoy
};

const KEY = 'widget_hoy_v1';

/** Lee el último snapshot guardado (o null). Lo usa el task handler del widget. */
export async function leerSnapshotWidget(): Promise<WidgetSnapshot | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

/** Guarda el snapshot y pide repintar el widget ya mismo (best-effort, solo en el rebuild). */
export async function guardarSnapshotWidget(snap: WidgetSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* ignorar */
  }
  try {
    // Lazy: requerir el paquete nativo Y las caras de los widgets acá adentro. En el dev-client
    // (sin el módulo nativo) esto tira y se ignora → NO rompe la app. Se ve recién en el rebuild.
    const { requestWidgetUpdate, getWidgetInfo } = require('react-native-android-widget');
    const { HoyWidget } = require('@/components/widget/HoyWidget');
    const { PorcentajeWidget } = require('@/components/widget/PorcentajeWidget');

    // Repinta un widget pasándole su TAMAÑO real (evita que 'match_parent' quede en 0 →
    // widget transparente). Busca el tamaño de la 1ra instancia colocada con getWidgetInfo.
    const pintar = (widgetName: 'Hoy' | 'Porcentaje', Cara: typeof HoyWidget | typeof PorcentajeWidget) => {
      Promise.resolve(getWidgetInfo?.(widgetName))
        .then((infos: Array<{ width: number; height: number }> | undefined) => {
          const size = infos?.[0];
          // requestWidgetUpdate RECHAZA async si el módulo no está → cada uno con su .catch().
          requestWidgetUpdate({
            widgetName,
            renderWidget: () => <Cara snap={snap} width={size?.width} height={size?.height} />,
            widgetNotFound: () => {},
          })?.catch?.(() => {});
        })
        .catch(() => {});
    };
    pintar('Hoy', HoyWidget);
    pintar('Porcentaje', PorcentajeWidget);
  } catch {
    /* módulo nativo ausente o sin widget agregado a la pantalla: ignorar */
  }
}
