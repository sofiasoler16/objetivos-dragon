// Edge Function: webhook de RevenueCat.
// 🔒 Fuente de verdad del Premium = tabla `suscripcion`. RevenueCat nos avisa de cada
// compra/renovación/cancelación/vencimiento y acá lo reflejamos en `suscripcion`.
// - Se autentica con un header Authorization secreto (REVENUECAT_WEBHOOK_AUTH), el mismo
//   valor que se configura en RevenueCat → Integrations → Webhooks.
// - Escribe con el SERVICE ROLE (bypassa RLS; el cliente NUNCA escribe suscripcion).
// - El `app_user_id` de RevenueCat es el user.id de Supabase (lo seteamos con Purchases.logIn).
// Desplegar con verify_jwt = false (RevenueCat no manda un JWT de Supabase).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RCEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  new_product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  entitlement_ids?: string[];
};

/** El id de usuario de Supabase que viene como app_user_id (o alias) del evento. */
function elegirUuid(ev: RCEvent): string | null {
  const cands = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])];
  for (const c of cands) if (typeof c === 'string' && UUID_RE.test(c)) return c;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Autenticación del webhook.
  const esperado = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!esperado || req.headers.get('Authorization') !== esperado) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { event?: RCEvent };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const ev = body?.event;
  if (!ev) return new Response('No event', { status: 400 });

  // Eventos de prueba de RevenueCat u otros sin uuid válido: respondemos 200 y no escribimos
  // (un 5xx haría que RevenueCat reintente para siempre).
  const uid = elegirUuid(ev);
  if (!uid) return new Response(JSON.stringify({ ok: true, skipped: 'sin uuid' }), { status: 200 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Si el usuario no existe en `perfil` (p. ej. el evento de PRUEBA de RevenueCat, o una cuenta
  // ya borrada), respondemos 200 y no escribimos: así el test da OK y RevenueCat no reintenta.
  const { data: existe } = await supabase
    .from('perfil')
    .select('id_usuario')
    .eq('id_usuario', uid)
    .maybeSingle();
  if (!existe) {
    return new Response(JSON.stringify({ ok: true, skipped: 'usuario inexistente' }), { status: 200 });
  }

  const tipo = ev.type ?? '';
  const expMs = ev.expiration_at_ms;
  const prod = String(ev.product_id ?? ev.new_product_id ?? '').toLowerCase();

  const plan =
    prod.includes('anual') || prod.includes('annual')
      ? 'PREMIUM_YEARLY'
      : prod.includes('mensual') || prod.includes('monthly')
        ? 'PREMIUM_MONTHLY'
        : 'PREMIUM';

  // Activo salvo que haya vencido. Además, si tenemos expiración, es_premium la respeta sola
  // (así, aunque se pierda el webhook de EXPIRATION, el Premium caduca en la fecha correcta).
  const activo = tipo !== 'EXPIRATION' && (expMs == null || expMs > Date.now());
  const expira = expMs ? new Date(expMs).toISOString() : null;
  const inicio = ev.purchased_at_ms ? new Date(ev.purchased_at_ms).toISOString() : new Date().toISOString();

  // Reemplaza la fila ANDROID del usuario por el estado actual (deja intactas las de prueba TEST).
  await supabase.from('suscripcion').delete().eq('id_usuario', uid).eq('platform', 'ANDROID');
  const { error } = await supabase.from('suscripcion').insert({
    id_usuario: uid,
    plan: activo ? plan : 'FREE',
    status: activo ? 'ACTIVE' : 'EXPIRED',
    start_date: inicio,
    expiration_date: expira,
    platform: 'ANDROID',
  });
  if (error) {
    // 5xx → RevenueCat reintenta (útil si fue un error transitorio de la base).
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, uid, activo }), {
    headers: { 'content-type': 'application/json' },
  });
});
