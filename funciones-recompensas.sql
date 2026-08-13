-- ============================================================
--  RPC — Otorgamiento de XP + monedas  (Paso 2, 🔒)
--  SECURITY DEFINER: escribe en movimiento_xp / movimiento_credito (bloqueadas
--  al cliente por RLS) validando auth.uid(). Idempotente por clave_idempotencia
--  (ON CONFLICT DO NOTHING) → marcar/desmarcar NO regala XP infinito.
--  Los MONTOS los decide el servidor por `p_motivo` (el cliente no los manda).
--    · objetivo → +10 XP / +5 monedas
--    · tarea    → +15 XP / +8 monedas
--  Después recalcula el caché en perfil (xp_total, creditos, nivel = XP/100 + 1).
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
  if v_uid is null then
    raise exception 'sin sesión';
  end if;

  if p_motivo = 'objetivo' then
    v_xp := 10; v_cred := 5;
  elsif p_motivo = 'tarea' then
    v_xp := 15; v_cred := 8;
  else
    return; -- motivo desconocido: no otorga nada
  end if;

  -- XP (cantidad siempre > 0). Clave única evita otorgar dos veces el mismo evento.
  insert into movimiento_xp (id_usuario, cantidad, motivo, clave_idempotencia)
  values (v_uid, v_xp, upper(p_motivo) || '_COMPLETED', 'xp:' || p_clave)
  on conflict (clave_idempotencia) do nothing;

  -- Monedas (+ al ganar).
  insert into movimiento_credito (id_usuario, monto, tipo, clave_idempotencia)
  values (v_uid, v_cred, upper(p_motivo) || '_COMPLETED', 'cr:' || p_clave)
  on conflict (clave_idempotencia) do nothing;

  -- Recalcular caché desde los logs (fuente de verdad).
  update perfil set
    xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = v_uid), 0),
    creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = v_uid), 0)
  where id_usuario = v_uid;

  update perfil set nivel = greatest(1, floor(xp_total / 100.0)::int + 1)
  where id_usuario = v_uid;
end;
$$;

grant execute on function otorgar_recompensa(text, text) to authenticated;
