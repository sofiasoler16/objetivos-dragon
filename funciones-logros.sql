-- ============================================================
--  RPC — Logros (achievements)  🔒
--  · evaluar_logros(): mira el HISTORIAL (registro_objetivo, mismo crédito que
--    Progreso) y desbloquea los logros nuevos que el usuario haya cumplido,
--    otorgando su XP/monedas de forma IDEMPOTENTE (clave 'logro:{id}').
--    Devuelve los logros recién desbloqueados (para celebrar en la app).
--    Además REGALA los dragones que ese logro habilita (usuario_dragon, precio 0):
--    los dragones de logro NO se compran, se entregan al cumplir la condición.
--  · Seed de los 3 logros iniciales (idempotente por nombre).
--  · comprar_dragon actualizado: guarda por si un dragón de historial se intentara
--    comprar; igualmente los de logro ya llegan regalados por evaluar_logros.
--
--  SECURITY DEFINER: escribe en movimiento_xp/credito + usuario_logro (bloqueadas
--  al cliente por RLS). auth.uid() sigue siendo el usuario que llama.
--  Correr en Supabase (SQL Editor). Idempotente: se puede correr varias veces.
--
--  Umbrales (ajustables acá):
--    RACHA           → días consecutivos al 100% (target_value del logro)
--    SEMANA_PERFECTA → últimos 7 días: días activos todos ≥80%, mín. 5 activos
-- ============================================================

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

  -- Racha actual: días consecutivos con esperados>0 y pct=100, contando desde hoy
  -- hacia atrás. Los días SIN objetivos esperados no cuentan ni cortan la racha.
  d := v_hoy;
  while d >= v_hoy - 59 loop
    select esperados, pct into v_esp, v_pct from _dias where fecha = d;
    if coalesce(v_esp, 0) = 0 then
      d := d - 1;
      continue;
    end if;
    if coalesce(v_pct, 0) >= 100 then
      v_racha := v_racha + 1;
      d := d - 1;
    else
      exit;
    end if;
  end loop;

  -- Semana perfecta: últimos 7 días. Contamos solo días activos (esperados>0);
  -- se cumple si hay al menos 5 activos y NINGUNO por debajo de 80%.
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

      -- Regalar los dragones que este logro habilita (misma regla = mismo rule_type).
      -- Los dragones de logro NO se compran: se entregan al cumplir la condición.
      insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
      select v_uid, d.id_dragon, 0
      from dragon d
      join dragon_regla_desbloqueo rr on rr.id_dragon = d.id_dragon
      where d.activo and rr.rule_type = rec.rule_type
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


-- ============================================================
--  Seed de logros iniciales (idempotente por nombre).
-- ============================================================
insert into logro (nombre, descripcion, rule_type, target_value, percentage_required, xp_reward, credit_reward)
select 'En racha', '3 días seguidos al 100%', 'RACHA', 3, null, 20, 10
where not exists (select 1 from logro where nombre = 'En racha');

insert into logro (nombre, descripcion, rule_type, target_value, percentage_required, xp_reward, credit_reward)
select 'Imparable', '7 días seguidos al 100%', 'RACHA', 7, null, 40, 25
where not exists (select 1 from logro where nombre = 'Imparable');

insert into logro (nombre, descripcion, rule_type, target_value, percentage_required, xp_reward, credit_reward)
select 'Semana perfecta', 'Una semana con todos los días arriba del 80%', 'SEMANA_PERFECTA', null, 80, 50, 30
where not exists (select 1 from logro where nombre = 'Semana perfecta');


-- ============================================================
--  comprar_dragon (actualizado): además de FREE/NIVEL/XP, respeta reglas de
--  HISTORIAL (ej. SEMANA_PERFECTA). Un dragón con una regla de historial se
--  habilita cuando el usuario tiene desbloqueado un logro de ese mismo rule_type.
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

  if exists (select 1 from usuario_dragon where id_usuario = v_uid and id_dragon = p_id_dragon) then
    raise exception 'Ya tenés este dragón';
  end if;

  select credit_cost, premium_required into v_cost, v_premium
  from dragon where id_dragon = p_id_dragon and activo;
  if not found then
    raise exception 'Dragón no disponible';
  end if;

  if v_premium then
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
  elsif v_rule is not null and v_rule not in ('FREE', 'NIVEL', 'XP') then
    -- regla de historial → exige el logro correspondiente (mismo rule_type)
    if not exists (
      select 1 from usuario_logro ul
      join logro l on l.id_logro = ul.id_logro
      where ul.id_usuario = v_uid and l.rule_type = v_rule
    ) then
      raise exception 'Todavía no desbloqueaste el logro necesario';
    end if;
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
