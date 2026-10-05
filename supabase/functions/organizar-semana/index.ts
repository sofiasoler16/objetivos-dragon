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

MUY IMPORTANTE — sé GENEROSO interpretando: casi cualquier pedido de HACER algo, IR a algún lado, EMPEZAR un hábito, entrenar, estudiar, una actividad, una cita o un pendiente ES agendable (objetivo o tarea). Ejemplos que SÍ debés agendar (nunca rechaces):
- "quiero ir al gimnasio el jueves" (una vez) → TAREA (fecha_limite ese jueves).
- "entregar el trabajo el jueves a las 2 de la tarde" → TAREA (fecha_limite ese jueves, hora_limite 14:00).
- "ir al gimnasio los martes" (recurrente) → OBJETIVO SPECIFIC_DAYS (martes).
- "estudiar 2 horas los lunes y miércoles" (recurrente con duración) → OBJETIVO con horario.
- "comprar comida", "llamar al médico" → TAREA.
SOLO respondé con objetivos y tareas vacíos y el mensaje "Solo puedo ayudarte a agendar objetivos y tareas 🐉" si el pedido NO tiene NADA que ver con organizar actividades/hábitos/pendientes (ej: "¿qué hora es?", "contame un chiste", "¿cómo estás?", preguntas de cultura general). Ante la duda, AGENDÁ (no rechaces).

Cómo mapear:

⭐ TAREA (una vez) vs OBJETIVO (se repite) — la regla más importante, misma lógica que la app:
- UNA SOLA VEZ ("este martes", "el jueves", "el jueves que viene", "mañana", "el 20 de agosto") → siempre una TAREA (un solo día). "fecha_limite" = ese día. Si mencionan una hora, esa hora va en "hora_limite" (es la hora de VENCIMIENTO, ej: "entregar el trabajo el jueves a las 2 de la tarde" → fecha_limite ese jueves, hora_limite 14:00). Las tareas NO se repiten y NO llevan bloque de horario ni evento de calendario.
- SE REPITE ("los martes", "todos los martes", "cada martes", "todos los días", "N veces por semana") → un OBJETIVO recurrente (sin "fecha_fin", salvo que den una fecha de fin). El objetivo SÍ puede llevar horario (bloque → evento de calendario).

- Objetivo recurrente → elegí la frecuencia:
  - "todos los días" → frecuencia_tipo DAILY.
  - días fijos que se repiten (lun/mié/vie) → SPECIFIC_DAYS con "dias" (números ISO). Si el usuario no fija los días pero sí una cantidad, VOS elegís una buena distribución (ej: 3 veces → lun, mié, vie).
  - "N veces por semana" sin importar qué días → WEEKLY_COUNT con "frecuencia_cantidad".
- Algo PUNTUAL sin hora (entregar algo, un trámite, rendir un examen) → una TAREA con "fecha_limite" (y "hora_limite" si hay una hora de vencimiento). Las TAREAS son solo un vencimiento: NUNCA llevan bloque de horario ni se agendan como evento.
- Tipo del objetivo:
  - Una DURACIÓN de tiempo ("2 horas", "30 minutos") NO es numérico: es tipo BOOLEAN (sí/no) y esa duración define el LARGO del bloque de horario (2 horas → un bloque de 2 h; 30 min → bloque de 30 min). meta_valor y unidad en null.
  - Una CANTIDAD contable por vez ("10 páginas", "5 km", "8000 pasos", "2000 ml") → tipo NUMERIC con "meta_valor" (número) y "unidad" ("páginas", "km", "pasos", "ml").
  - Hacer/no hacer sin cantidad → tipo BOOLEAN.
- Si hay una fecha límite general (ej: un examen el 15/8), poné esa fecha en "fecha_fin" del objetivo relacionado, y además podés crear una TAREA para el evento (ej: "Rendir Materia" con fecha_limite).
- Categorías: elegí "id_categoria" SOLO de esta lista (o null si ninguna encaja). NO inventes categorías ni ids.
${lista}

HORARIOS (importante):
- Si algo tiene una HORA o BLOQUE concreto, o una DURACIÓN ("clase de 10:30 a 12", "gimnasio a las 18", "estudiar 2 horas") → dale un horario. Eso lo agenda como EVENTO en el calendario.
- DAILY (todos los días): usá "hora_inicio"/"hora_fin" (una sola hora).
- SPECIFIC_DAYS (días fijos): usá "horarios_dia" = una entrada POR DÍA { "dia": N, "hora_inicio": "HH:MM", "hora_fin": "HH:MM" }. PODÉS y CONVIENE poner horas DISTINTAS por día si ayuda a evitar choques. Si el usuario no pide horas distintas, poné la misma en todos.
- Si el usuario pide una DURACIÓN sin hora exacta ("2 horas"), ELEGÍ vos un bloque libre de esa duración (mañana/tarde/noche razonable) para cada día. EVITÁ pisar los compromisos de ABAJO.
- Revisá CADA día del objetivo (no solo el primero) contra los compromisos, y NO uses el mismo horario para dos objetivos/tareas que caen el mismo día.
- Algo GENERAL sin hora ni duración ("ir a montar", "tomar agua") → sin horario (hora_inicio/hora_fin null y horarios_dia null): es objetivo del día, no evento.
- WEEKLY_COUNT nunca lleva horario (no tiene día fijo).
- Podés agendar en fechas FUTURAS usando "fecha_inicio"/"fecha_limite". No te limites a esta semana.

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
      "hora_inicio": "HH:MM o null (solo DAILY)",
      "hora_fin": "HH:MM o null (solo DAILY)",
      "horarios_dia": [ { "dia": 1, "hora_inicio": "HH:MM", "hora_fin": "HH:MM" } ]
    }
  ],
  "tareas": [
    {
      "titulo": "string",
      "descripcion": "string o null",
      "prioridad": "BAJA" | "MEDIA" | "ALTA",
      "id_categoria": "string o null",
      "fecha_limite": "YYYY-MM-DD o null",
      "hora_limite": "HH:MM o null"
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

    // 🔒 Límite mensual SERVER-SIDE: consume 1 uso (o rechaza si llegó al tope) ANTES de llamar al
    // modelo, así protege los créditos de la API. Cuenta por mes calendario. Si la RPC no está (aún
    // sin migrar), `usoErr` → no bloqueamos (falla abierto para no romper la IA).
    const { data: uso, error: usoErr } = await supabase.rpc('consumir_ia');
    const filaUso = Array.isArray(uso) ? uso[0] : uso;
    if (!usoErr && filaUso && filaUso.permitido === false)
      // 200 con marca: así el cliente lo lee de `data` (invoke solo pone `error` en fallos de red/5xx).
      return json({ error: 'limite', usados: filaUso.usados, limite: filaUso.limite });

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
        temperature: 0.2, // baja aleatoriedad → respuestas consistentes (mismo pedido, mismo resultado)
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
