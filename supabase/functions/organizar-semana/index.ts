// Edge Function: "Organizá mi semana".
// Recibe { texto, hoy, categorias } → llama a Claude Haiku → devuelve SOLO un JSON con
// objetivos/tareas propuestos usando el schema de la app. La IA PROPONE; el cliente valida,
// muestra y (si el usuario confirma) escribe. La API key vive como SECRET, nunca en la app.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = 'claude-haiku-4-5-20251001';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

/** Propuesta vacía + mensaje (guardrail / errores suaves). */
function vacia(mensaje: string) {
  return { mensaje, objetivos: [], tareas: [] };
}

type CategoriaCtx = { id: string; nombre: string };
type CompromisoCtx = { titulo: string; fecha: string; desde: string; hasta: string };

function systemPrompt(hoy: string, categorias: CategoriaCtx[], compromisos: CompromisoCtx[]): string {
  const lista = categorias.length
    ? categorias.map((c) => `- ${c.nombre} (id: ${c.id})`).join('\n')
    : '(el usuario no tiene categorías)';

  const ocupado = compromisos.length
    ? compromisos.map((c) => `- ${c.fecha} ${c.desde}–${c.hasta}: ${c.titulo}`).join('\n')
    : '(no hay nada agendado en las próximas 2 semanas)';

  return `Sos el asistente de una app de objetivos y tareas. Tu ÚNICA función es convertir un pedido en lenguaje natural en objetivos y tareas para agendar. NO conversás de otros temas, no das opiniones, no respondés preguntas que no sean para agendar.

Hoy es ${hoy}. La semana empieza el LUNES. Los días se numeran ISO: 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado, 7=domingo.

Si el pedido NO es para agendar objetivos/tareas (ej: preguntas, charla, pedidos fuera de tema), respondé con objetivos y tareas vacíos y un mensaje amable: "Solo puedo ayudarte a agendar objetivos y tareas 🐉".

Cómo mapear:
- Algo que se REPITE en el tiempo → un OBJETIVO. Elegí la frecuencia:
  - "todos los días" → frecuencia_tipo DAILY.
  - días fijos (lun/mié/vie) → SPECIFIC_DAYS con "dias" (números ISO). Si el usuario no fija los días pero sí una cantidad, VOS elegís una buena distribución (ej: 3 veces → lun, mié, vie).
  - "N veces por semana" sin importar qué días → WEEKLY_COUNT con "frecuencia_cantidad".
- Algo PUNTUAL con fecha (entregar algo, un trámite, rendir un examen) → una TAREA con "fecha_limite".
- Tipo del objetivo:
  - Si hay una cantidad medible por vez (ej: "2 horas", "30 minutos", "10 páginas") → tipo NUMERIC con "meta_valor" (número) y "unidad" (ej: "min", "horas", "páginas"). Convertí a la unidad más natural (2 horas → meta_valor 120, unidad "min").
  - Si es hacer/no hacer → tipo BOOLEAN (meta_valor y unidad en null).
- Si hay una fecha límite general (ej: un examen el 15/8), poné esa fecha en "fecha_fin" del objetivo relacionado, y además podés crear una TAREA para el evento (ej: "Rendir Materia" con fecha_limite).
- Categorías: elegí "id_categoria" SOLO de esta lista (o null si ninguna encaja). NO inventes categorías ni ids.
${lista}

HORARIOS (importante):
- Si algo tiene una HORA o BLOQUE concreto (ej: "clase de 10:30 a 12", "gimnasio a las 18") → poné "hora_inicio" y "hora_fin" (HH:MM). Eso lo agenda como EVENTO en el calendario.
- Si el usuario pide una DURACIÓN pero NO una hora (ej: "estudiar 2 horas"), ELEGÍ vos un bloque libre y coherente (mañana/tarde/noche razonable) y ponelo en "hora_inicio"/"hora_fin". EVITÁ pisar los compromisos de la lista de ABAJO. Ej: 2 horas → un bloque de 2 horas en un hueco libre.
- IMPORTANTE al elegir horarios: revisá TODOS los días en que el objetivo cae (no solo el primero) contra los compromisos, y NO uses el mismo horario para dos objetivos/tareas que caen el mismo día. Buscá un hueco que sirva para todos sus días.
- Si es algo GENERAL sin hora ni duración (ej: "ir a montar", "tomar agua") → dejá "hora_inicio" y "hora_fin" en null (es un objetivo del día, no un evento).
- WEEKLY_COUNT nunca lleva horario (no tiene día fijo): hora_inicio/hora_fin siempre null.
- Podés agendar en fechas FUTURAS (semanas próximas) usando "fecha_inicio"/"fecha_limite". No te limites a esta semana si el pedido lo amerita.

Compromisos YA ocupados (NO los pises al elegir horarios):
${ocupado}

Prioridad de tareas: BAJA, MEDIA o ALTA (default MEDIA; un examen/entrega importante → ALTA).
Fechas SIEMPRE en formato YYYY-MM-DD. Horas en HH:MM (o null). "hora_fin" siempre después de "hora_inicio".

Respondé ÚNICAMENTE con un objeto JSON válido (sin texto extra, sin \`\`\`) con EXACTAMENTE esta forma:
{
  "mensaje": "frase corta para el usuario",
  "objetivos": [
    {
      "nombre": "string",
      "descripcion": "string o null",
      "tipo": "BOOLEAN" | "NUMERIC",
      "meta_valor": number | null,
      "unidad": "string o null",
      "frecuencia_tipo": "DAILY" | "SPECIFIC_DAYS" | "WEEKLY_COUNT",
      "dias": [numeros 1..7] | null,
      "frecuencia_cantidad": number | null,
      "id_categoria": "string o null",
      "fecha_inicio": "YYYY-MM-DD o null",
      "fecha_fin": "YYYY-MM-DD o null",
      "hora_inicio": "HH:MM o null",
      "hora_fin": "HH:MM o null"
    }
  ],
  "tareas": [
    {
      "titulo": "string",
      "descripcion": "string o null",
      "prioridad": "BAJA" | "MEDIA" | "ALTA",
      "id_categoria": "string o null",
      "fecha_limite": "YYYY-MM-DD o null",
      "hora_limite": "HH:MM o null",
      "hora_inicio": "HH:MM o null",
      "hora_fin": "HH:MM o null"
    }
  ]
}`;
}

/** Extrae el primer objeto JSON del texto (por si el modelo agrega algo alrededor). */
function parseJSON(texto: string): unknown | null {
  try {
    return JSON.parse(texto);
  } catch {
    const i = texto.indexOf('{');
    const j = texto.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(texto.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    // Autenticación: solo usuarios logueados (protege tus créditos de la IA).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'no-auth' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: 'no-auth' }, 401);

    if (!ANTHROPIC_API_KEY) return json({ error: 'no-key' }, 500);

    const { texto, hoy, categorias, compromisos } = await req.json().catch(() => ({}));
    if (!texto || typeof texto !== 'string' || !texto.trim())
      return json(vacia('Contame qué querés agendar 🐉'));

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        system: systemPrompt(
          typeof hoy === 'string' ? hoy : '',
          Array.isArray(categorias) ? categorias : [],
          Array.isArray(compromisos) ? compromisos : [],
        ),
        messages: [{ role: 'user', content: texto.slice(0, 2000) }],
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      return json({ error: 'ia', detalle }, 502);
    }

    const data = await resp.json();
    const salida = (data?.content ?? [])
      .filter((b: { type?: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('');
    const propuesta = parseJSON(salida);
    if (!propuesta || typeof propuesta !== 'object')
      return json(vacia('No pude entender el pedido. Probá reformularlo 🐉'));

    return json(propuesta);
  } catch (e) {
    return json({ error: 'server', detalle: String(e) }, 500);
  }
});
