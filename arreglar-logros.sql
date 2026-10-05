-- ============================================================
--  ARREGLOS DE LOGROS (2026-09-04) — correr una vez en Supabase.
--  · Racha de los logros ahora es ≥85% (coincide con la racha visible / el fueguito),
--    antes exigía 100%.
--  · Un logro regala su dragón matcheando rule_type Y target_value (antes solo rule_type →
--    "En racha" (3 días) regalaba el Fénix antes de tiempo). Ahora el Fénix 🔥 lo da SOLO
--    "Imparable" (7 días).
--  · Se DESACTIVA "Semana perfecta".
--  · El dragón de Hielo ❄️ pasa a ganarse por NIVEL 15 (antes por Semana perfecta).
--  · Textos de "En racha" e "Imparable" corregidos (≥85%, no 100%).
-- ============================================================

-- 1) evaluar_logros(): racha ≥85% + regalo de dragón por rule_type + target_value.
create or replace function evaluar_logros()
returns table (
  id_logro      uuid,
  nombre        text,
  descripcion   text,
  xp_reward     int,
  credit_reward int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_racha int := 0;
  v_activos_semana int := 0;
  v_bajos_semana   int := 0;
  v_semana_perfecta boolean := false;
  v_esp   int;
  v_pct   numeric;
  d       date;
  rec     record;
begin
  if v_uid is null then raise exception 'sin sesión'; end if;

  -- % por día de los últimos 60 días (MISMO crédito que Progreso 🔒).
  create temp table _dias on commit drop as
  with dias as (
    select g::date as fecha
    from generate_series(v_hoy - 59, v_hoy, interval '1 day') g
  ),
  celdas as (
    select
      dias.fecha,
      o.id_objetivo,
      case
        when o.tipo = 'NUMERIC' and o.meta_valor > 0
          then least(1, coalesce(r.valor, 0) / o.meta_valor)
        when coalesce(r.completado, false) then 1
        else 0
      end as credito
    from dias
    join objetivo o
      on o.id_usuario = v_uid
     and o.activo
     and o.frecuencia_tipo in ('DAILY', 'SPECIFIC_DAYS')
     and o.fecha_inicio <= dias.fecha
     and (o.fecha_fin is null or o.fecha_fin >= dias.fecha)
     and (
       o.frecuencia_tipo = 'DAILY'
       or exists (
         select 1 from objetivo_dia od
         where od.id_objetivo = o.id_objetivo
           and od.dia_semana = extract(isodow from dias.fecha)
       )
     )
    left join registro_objetivo r
      on r.id_objetivo = o.id_objetivo and r.fecha = dias.fecha
    where not coalesce(r.omitido, false)
  )
  select
    dias.fecha,
    count(c.id_objetivo)::int as esperados,
    coalesce(round(sum(c.credito) / nullif(count(c.id_objetivo), 0) * 100), 0) as pct
  from dias
  left join celdas c on c.fecha = dias.fecha
  group by dias.fecha;

  -- Racha actual: días consecutivos con esperados>0 y pct >= 85 (mismo umbral que la racha
  -- visible / el fueguito), contando desde hoy hacia atrás. Los días SIN objetivos esperados
  -- no cuentan ni cortan la racha.
  d := v_hoy;
  while d >= v_hoy - 59 loop
    select esperados, pct into v_esp, v_pct from _dias where fecha = d;
    if coalesce(v_esp, 0) = 0 then
      d := d - 1;
      continue;
    end if;
    if coalesce(v_pct, 0) >= 85 then
      v_racha := v_racha + 1;
      d := d - 1;
    else
      exit;
    end if;
  end loop;

  -- Semana perfecta: se conserva el cálculo por compatibilidad, pero el logro está desactivado.
  select
    count(*) filter (where esperados > 0),
    count(*) filter (where esperados > 0 and pct < 80)
  into v_activos_semana, v_bajos_semana
  from _dias
  where fecha > v_hoy - 7;
  v_semana_perfecta := (v_activos_semana >= 5 and v_bajos_semana = 0);

  -- Evaluar cada logro activo que el usuario todavía NO tenga.
  for rec in
    select l.*
    from logro l
    where l.activo
      and not exists (
        select 1 from usuario_logro ul
        where ul.id_usuario = v_uid and ul.id_logro = l.id_logro
      )
  loop
    if (rec.rule_type = 'RACHA' and v_racha >= coalesce(rec.target_value, 0))
       or (rec.rule_type = 'SEMANA_PERFECTA' and v_semana_perfecta)
    then
      insert into usuario_logro (id_usuario, id_logro)
      values (v_uid, rec.id_logro)
      on conflict do nothing;

      if rec.xp_reward > 0 then
        insert into movimiento_xp (id_usuario, cantidad, motivo, clave_idempotencia)
        values (v_uid, rec.xp_reward, 'LOGRO', 'xp:logro:' || rec.id_logro::text)
        on conflict (clave_idempotencia) do nothing;
      end if;
      if rec.credit_reward > 0 then
        insert into movimiento_credito (id_usuario, monto, tipo, clave_idempotencia)
        values (v_uid, rec.credit_reward, 'LOGRO', 'cr:logro:' || rec.id_logro::text)
        on conflict (clave_idempotencia) do nothing;
      end if;

      -- Regalar el dragón que este logro habilita (misma regla Y mismos días/target).
      -- Los dragones de logro NO se compran: se entregan al cumplir la condición.
      insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
      select v_uid, d.id_dragon, 0
      from dragon d
      join dragon_regla_desbloqueo rr on rr.id_dragon = d.id_dragon
      where d.activo
        and rr.rule_type = rec.rule_type
        and coalesce(rr.target_value, 0) = coalesce(rec.target_value, 0)
      on conflict (id_usuario, id_dragon) do nothing;

      id_logro := rec.id_logro;
      nombre := rec.nombre;
      descripcion := rec.descripcion;
      xp_reward := rec.xp_reward;
      credit_reward := rec.credit_reward;
      return next;
    end if;
  end loop;

  -- Recalcular caché del perfil desde los logs.
  update perfil set
    xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = v_uid), 0),
    creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = v_uid), 0)
  where id_usuario = v_uid;
  update perfil set nivel = greatest(1, floor(xp_total / 100.0)::int + 1) where id_usuario = v_uid;
end;
$$;

grant execute on function evaluar_logros() to authenticated;

-- 2) dragon_de_logro(): matchear también por target_value (no solo rule_type).
create or replace function public.dragon_de_logro(p_id_logro uuid)
returns table (id_dragon uuid, asset_key text, nombre text, id_tema uuid)
language sql security definer set search_path = public stable
as $$
  select d.id_dragon, d.asset_key, d.nombre, d.id_tema
  from logro l
  join dragon_regla_desbloqueo rr
    on rr.rule_type = l.rule_type
   and coalesce(rr.target_value, 0) = coalesce(l.target_value, 0)
  join dragon d on d.id_dragon = rr.id_dragon and d.activo
  where l.id_logro = p_id_logro
  limit 1;
$$;

grant execute on function public.dragon_de_logro(uuid) to authenticated;

-- 3) Desactivar el logro "Semana perfecta" (cualquiera sea su nombre exacto).
update logro set activo = false where rule_type = 'SEMANA_PERFECTA';

-- 4) Corregir los textos (la racha es ≥85%, no 100%).
update logro set descripcion = '3 días seguidos cumpliendo al menos el 85%' where nombre = 'En racha';
update logro set descripcion = '7 días seguidos cumpliendo al menos el 85%' where nombre = 'Imparable';

-- 5) Hielo ❄️: pasa de "Semana perfecta" a ganarse por NIVEL 15 (credit_cost ya es 0 → se reclama gratis).
update dragon_regla_desbloqueo
set rule_type = 'NIVEL', target_value = 15, percentage_required = null
where id_dragon = (select id_dragon from dragon where nombre = 'Hielo');

update dragon
set descripcion = 'Un dragón de escarcha: se gana al llegar al nivel 15.'
where nombre = 'Hielo';
