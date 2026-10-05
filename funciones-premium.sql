-- ============================================================
--  PREMIUM del lado del servidor (fuente de verdad = tabla `suscripcion`) 🔒
--  · es_premium()                    → ¿el usuario tiene Premium activo?
--  · establecer_premium_prueba(bool) → toggle de PRUEBA (escribe suscripcion).
--    Cuando se integre RevenueCat, su WEBHOOK escribirá `suscripcion` y estas
--    funciones quedan igual (se elimina solo el toggle de prueba).
--  · comprar_dragon actualizado: valida Premium contra `suscripcion`.
-- ============================================================

-- ¿El usuario actual tiene una suscripción Premium activa?
create or replace function public.es_premium()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from suscripcion s
    where s.id_usuario = auth.uid()
      and s.status = 'ACTIVE'
      and s.plan <> 'FREE'
      and (s.expiration_date is null or s.expiration_date > now())
  );
$$;

-- Toggle de PRUEBA de Premium (sin cobro real). Se reemplaza por el webhook de RevenueCat.
create or replace function public.establecer_premium_prueba(p_activo boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  delete from suscripcion where id_usuario = v_uid and platform = 'TEST';
  if p_activo then
    insert into suscripcion (id_usuario, plan, status, start_date, platform)
    values (v_uid, 'PREMIUM', 'ACTIVE', now(), 'TEST');
  end if;
  return p_activo;
end;
$$;

grant execute on function public.es_premium() to authenticated;
grant execute on function public.establecer_premium_prueba(boolean) to authenticated;

-- ── comprar_dragon: ahora valida Premium contra `suscripcion` ────────────────
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

  if exists (select 1 from usuario_dragon where id_usuario = v_uid and id_dragon = p_id_dragon) then
    raise exception 'Ya tenés este dragón';
  end if;

  select credit_cost, premium_required into v_cost, v_premium
  from dragon where id_dragon = p_id_dragon and activo;
  if not found then
    raise exception 'Dragón no disponible';
  end if;

  -- premium: si el dragón lo requiere, validar suscripción activa (fuente de verdad: suscripcion)
  if v_premium and not es_premium() then
    raise exception 'Requiere Premium';
  end if;

  select nivel, xp_total, creditos into v_nivel, v_xp, v_creditos
  from perfil where id_usuario = v_uid;

  select rule_type, target_value into v_rule, v_target
  from dragon_regla_desbloqueo where id_dragon = p_id_dragon limit 1;
  if v_rule = 'NIVEL' and v_nivel < coalesce(v_target, 0) then
    raise exception 'Todavía no cumplís el requisito de nivel';
  elsif v_rule = 'XP' and v_xp < coalesce(v_target, 0) then
    raise exception 'Todavía no cumplís el requisito de XP';
  end if;

  if v_creditos < v_cost then
    raise exception 'No te alcanzan las monedas';
  end if;

  insert into movimiento_credito (id_usuario, monto, tipo, id_dragon, clave_idempotencia)
  values (v_uid, -v_cost, 'DRAGON_PURCHASE', p_id_dragon, 'compra:' || p_id_dragon::text)
  on conflict (clave_idempotencia) do nothing;

  insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
  values (v_uid, p_id_dragon, v_cost)
  on conflict (id_usuario, id_dragon) do nothing;

  update perfil set creditos = coalesce(
    (select sum(monto) from movimiento_credito where id_usuario = v_uid), 0
  )
  where id_usuario = v_uid;
end;
$$;

grant execute on function comprar_dragon(uuid) to authenticated;
