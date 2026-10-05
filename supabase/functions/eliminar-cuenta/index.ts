// Edge Function: eliminar la cuenta del usuario actual + TODOS sus datos.
// Requisito de Google Play para apps con login. El cliente la llama autenticado;
// acá identificamos al usuario por su token y lo borramos con el service role.
// Borrar el usuario de auth.users borra en cascada `perfil` y todo lo que cuelga de él.
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'No autenticado' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;

  // Cliente con el token del usuario → identificamos de forma segura a quién borrar.
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) return json({ error: 'Sesión inválida' }, 401);

  // Cliente admin (service role) para borrar el usuario. La cascada limpia todos sus datos.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
