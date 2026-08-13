-- ============================================================
--  RPC — Recompensas v2  (prioridades + devolución al desmarcar)
--  Reemplaza otorgar_recompensa (create or replace) y agrega revocar_recompensa.
--  Montos server-side por motivo:
--    objetivo     → +10 XP / +5 🪙
--    tarea_baja   → +10 XP / +5 🪙
--    tarea_media  → +15 XP / +8 🪙
--    tarea_alta   → +25 XP / +13 🪙
--  revocar_recompensa: borra los movimientos de esa clave y recalcula (se usa SOLO
--  al DESMARCAR a mano, para corregir un error; no es un castigo por incumplir).
-- ============================================================
create or replace function otorgar_recompensa(p_motivo text, p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_xp   int;
  v_cred int;
begin
  if v_uid is null then raise exception 'sin sesión'; end if;

  if p_motivo = 'objetivo' or p_motivo = 'tarea_baja' then
    v_xp := 10; v_cred := 5;
  elsif p_motivo = 'tarea_media' then
    v_xp := 15; v_cred := 8;
  elsif p_motivo = 'tarea_alta' then
    v_xp := 25; v_cred := 13;
  else
    return; -- motivo desconocido
  end if;

  insert into movimiento_xp (id_usuario, cantidad, motivo, clave_idempotencia)
  values (v_uid, v_xp, upper(p_motivo), 'xp:' || p_clave)
  on conflict (clave_idempotencia) do nothing;

  insert into movimiento_credito (id_usuario, monto, tipo, clave_idempotencia)
  values (v_uid, v_cred, upper(p_motivo), 'cr:' || p_clave)
  on conflict (clave_idempotencia) do nothing;

  update perfil set
    xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = v_uid), 0),
    creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = v_uid), 0)
  where id_usuario = v_uid;
  update perfil set nivel = greatest(1, floor(xp_total / 100.0)::int + 1) where id_usuario = v_uid;
end;
$$;

-- Devuelve (borra) la recompensa de una clave. Al re-marcar se vuelve a otorgar.
create or replace function revocar_recompensa(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'sin sesión'; end if;

  delete from movimiento_xp      where id_usuario = v_uid and clave_idempotencia = 'xp:' || p_clave;
  delete from movimiento_credito where id_usuario = v_uid and clave_idempotencia = 'cr:' || p_clave;

  update perfil set
    xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = v_uid), 0),
    creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = v_uid), 0)
  where id_usuario = v_uid;
  update perfil set nivel = greatest(1, floor(xp_total / 100.0)::int + 1) where id_usuario = v_uid;
end;
$$;

grant execute on function otorgar_recompensa(text, text) to authenticated;
grant execute on function revocar_recompensa(text) to authenticated;
