// Cara del widget "Porcentaje" (react-native-android-widget). Dibuja SOLO el % del día (número
// grande + barra de progreso), sin la lista. Usa el mismo snapshot que el widget "Hoy" (percent).
// Tocar el widget abre la app.
// OJO: importa react-native-android-widget (nativo). Solo se carga vía lazy require (desde
// lib/widget.tsx y widget-task-handler), nunca en el árbol normal de la app.

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@/lib/widget';

// Paleta fija (el widget no lee el tema del dragón equipado). Identidad violeta + fondo verde.
const BG = '#f1f8f3';
const PRIMARY = '#6c4cd6';
const TEXT = '#2a2540';
const MUTED = '#9a94ad';
const DONE = '#3fae6b';
const TRACK = '#e4e0ef';

export function PorcentajeWidget({
  snap,
  width,
  height,
}: {
  snap: WidgetSnapshot | null;
  width?: number;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(snap?.percent ?? 0)));
  const hayDatos = snap != null;
  const fill = pct >= 85 ? DONE : PRIMARY;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        // Tamaño explícito (evita que 'match_parent' quede en 0 y se vea transparente).
        height: height ?? 'match_parent',
        width: width ?? 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BG,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <TextWidget
        text="🐉 Hoy"
        style={{ fontSize: 13, fontWeight: 'bold', color: PRIMARY, marginBottom: 2 }}
      />

      <TextWidget
        text={hayDatos ? `${pct}%` : '—'}
        style={{ fontSize: 40, fontWeight: 'bold', color: hayDatos ? TEXT : MUTED }}
      />

      {/* Barra de progreso: dos cajas con peso flex (relleno vs pista). */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 8,
          borderRadius: 6,
          backgroundColor: TRACK,
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        <FlexWidget style={{ flex: pct, height: 'match_parent', backgroundColor: fill, borderRadius: 6 }} />
        <FlexWidget style={{ flex: 100 - pct, height: 'match_parent', backgroundColor: TRACK }} />
      </FlexWidget>

      <TextWidget
        text="del día cumplido"
        style={{ fontSize: 11, color: MUTED, marginTop: 6 }}
      />
    </FlexWidget>
  );
}
