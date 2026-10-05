// Cara del widget "Hoy" (react-native-android-widget). Dibuja SOLO la lista de objetivos y
// tareas de hoy (sin porcentaje — eso irá en un widget aparte). Tocar el widget abre la app.
// OJO: este archivo importa react-native-android-widget (nativo). Solo se carga vía lazy require
// (desde lib/widget.tsx y widget-task-handler), nunca en el árbol normal de la app.

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@/lib/widget';

// Paleta fija (el widget no lee el tema del dragón equipado). Identidad violeta + fondo verde.
const BG = '#f1f8f3';
const SURFACE = '#ffffff';
const PRIMARY = '#6c4cd6';
const TEXT = '#2a2540';
const MUTED = '#9a94ad';
const DONE = '#3fae6b';

const MAX_ITEMS = 6;

export function HoyWidget({
  snap,
  width,
  height,
}: {
  snap: WidgetSnapshot | null;
  width?: number;
  height?: number;
}) {
  const items = snap?.items ?? [];
  const visibles = items.slice(0, MAX_ITEMS);
  const restantes = items.length - visibles.length;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        // Tamaño explícito (evita que 'match_parent' quede en 0 y se vea transparente).
        height: height ?? 'match_parent',
        width: width ?? 'match_parent',
        flexDirection: 'column',
        backgroundColor: BG,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <TextWidget
        text="🐉 Hoy"
        style={{ fontSize: 13, fontWeight: 'bold', color: PRIMARY, marginBottom: 6 }}
      />

      {items.length === 0 ? (
        <TextWidget
          text="¡Nada pendiente para hoy! 🎉"
          style={{ fontSize: 13, color: MUTED, marginTop: 4 }}
        />
      ) : (
        visibles.map((it, i) => (
          <FlexWidget
            key={`${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: SURFACE,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 5,
              marginBottom: 4,
              width: 'match_parent',
            }}
          >
            <TextWidget
              text={it.hecho ? '✓' : '○'}
              style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: it.hecho ? DONE : MUTED,
                marginRight: 8,
              }}
            />
            <TextWidget
              text={it.nombre}
              maxLines={1}
              style={{ fontSize: 13, color: it.hecho ? MUTED : TEXT }}
            />
          </FlexWidget>
        ))
      )}

      {restantes > 0 ? (
        <TextWidget
          text={`+${restantes} más`}
          style={{ fontSize: 11, color: MUTED, marginTop: 2 }}
        />
      ) : null}
    </FlexWidget>
  );
}
