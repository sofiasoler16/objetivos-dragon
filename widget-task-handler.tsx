// Task handler de los widgets (react-native-android-widget). Corre en un contexto HEADLESS (sin UI,
// con la app cerrada) cuando Android agrega/actualiza/redimensiona un widget. Lee el snapshot que
// dejó la app y dibuja el widget que corresponda según su nombre. Se registra en index.js (lazy,
// para no romper el dev-client).

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { HoyWidget } from '@/components/widget/HoyWidget';
import { PorcentajeWidget } from '@/components/widget/PorcentajeWidget';
import { leerSnapshotWidget } from '@/lib/widget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snap = await leerSnapshotWidget();
      // Tamaño real del widget (en dp): se lo pasamos a la cara para que la imagen NO quede
      // en 0 y transparente (falla típica de 'match_parent' en esta librería).
      const { width, height } = props.widgetInfo;
      // Cada widget declarado en app.json (name) tiene su cara.
      if (props.widgetInfo.widgetName === 'Porcentaje') {
        props.renderWidget(<PorcentajeWidget snap={snap} width={width} height={height} />);
      } else {
        props.renderWidget(<HoyWidget snap={snap} width={width} height={height} />);
      }
      break;
    }
    case 'WIDGET_CLICK':
      // clickAction="OPEN_APP" ya abre la app; nada que hacer acá.
      break;
    case 'WIDGET_DELETED':
    default:
      break;
  }
}
