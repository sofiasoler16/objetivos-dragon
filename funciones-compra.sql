-- ============================================================
--  RPC — Comprar dragón  (Paso 3, 🔒)
--  SECURITY DEFINER: escribe en movimiento_credito + usuario_dragon (bloqueadas
--  al cliente por RLS). Valida TODO del lado del servidor:
--    ¿ya lo tiene? · ¿premium? · ¿cumple requisito (FREE/NIVEL/XP)? · ¿le alcanza?
--  Resta créditos (movimiento negativo), registra la compra, recalcula el caché.
--  Idempotente por clave 'compra:{id_dragon}'. Equipar va aparte (upsert client-side).
-- ============================================================
create or replace function comprar_dragon(p_id_dragon uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_cost     int;
  v_premium  boolean;
  v_rule     text;
  v_target   numeric;
  v_nivel    int;
  v_xp       int;
  v_creditos int;
begin
  if v_uid is null then
    raise exception 'sin sesión';
  end if;

  -- ¿ya lo tiene?
  if exists (select 1 from usuario_dragon where id_usuario = v_uid and id_dragon = p_id_dragon) then
    raise exception 'Ya tenés este dragón';
  end if;

  -- catálogo
  select credit_cost, premium_required into v_cost, v_premium
  from dragon where id_dragon = p_id_dragon and activo;
  if not found then
    raise exception 'Dragón no disponible';
  end if;

  -- premium (todavía no hay suscripción → si lo requiere, se bloquea)
  if v_premium then
    raise exception 'Requiere Premium';
  end if;

  -- stats del usuario
  select nivel, xp_total, creditos into v_nivel, v_xp, v_creditos
  from perfil where id_usuario = v_uid;

  -- requisito de desbloqueo (FREE por defecto; NIVEL/XP se validan; el resto se permite por ahora)
  select rule_type, target_value into v_rule, v_target
  from dragon_regla_desbloqueo where id_dragon = p_id_dragon limit 1;
  if v_rule = 'NIVEL' and v_nivel < coalesce(v_target, 0) then
    raise exception 'Todavía no cumplís el requisito de nivel';
  elsif v_rule = 'XP' and v_xp < coalesce(v_target, 0) then
    raise exception 'Todavía no cumplís el requisito de XP';
  end if;

  -- ¿le alcanzan las monedas?
  if v_creditos < v_cost then
    raise exception 'No te alcanzan las monedas';
  end if;

  -- restar créditos (movimiento negativo) — idempotente por dragón
  insert into movimiento_credito (id_usuario, monto, tipo, id_dragon, clave_idempotencia)
  values (v_uid, -v_cost, 'DRAGON_PURCHASE', p_id_dragon, 'compra:' || p_id_dragon::text)
  on conflict (clave_idempotencia) do nothing;

  -- registrar la compra (con el precio pagado en el momento)
  insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
  values (v_uid, p_id_dragon, v_cost)
  on conflict (id_usuario, id_dragon) do nothing;

  -- recalcular caché de créditos desde los logs
  update perfil set creditos = coalesce(
    (select sum(monto) from movimiento_credito where id_usuario = v_uid), 0
  )
  where id_usuario = v_uid;
end;
$$;

grant execute on function comprar_dragon(uuid) to authenticated;
