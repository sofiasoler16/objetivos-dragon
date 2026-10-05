-- ============================================================
--  % DEL DÍA — función única, reutilizada por Progreso y por los Logros
--  Corré este archivo en el SQL Editor de Supabase. Reemplaza/supersede a arreglar-logros-2.
--
--  PROBLEMA que resuelve: el % del día estaba calculado en DOS lugares distintos:
--    · progreso_por_dia (Progreso / racha visible) → objetivos + tareas
--    · evaluar_logros (logros)                     → solo objetivos, y con "hoy" que cortaba
--  Al no coincidir, podías tener "racha 7" en pantalla y que el logro NO se desbloqueara.
--
--  SOLUCIÓN (idea de la usuaria): UNA sola función `pct_dias_persona(desde, hasta)` que calcula el
--  % de cada día (objetivos + tareas, 🔒 mismo crédito que Hoy). Tanto progreso_por_dia como
--  evaluar_logros la reusan → imposible que se desincronicen.
-- ============================================================

-- ---------- Función CANÓNICA del % por día (objetivos + tareas) ----------
-- Usa auth.uid() (el usuario actual): objetivos DAILY/SPECIFIC_DAYS (BOOLEAN 0/1, NUMERIC/DURATION
-- proporcional, omitido fuera) + tareas que vencen ese día (Sí/No). Un solo lugar, una sola verdad.
create or replace function public.pct_dias_persona(p_desde date, p_hasta date)
returns table (fecha date, esperados int, credito numeric, pct numeric)
language sql stable
set search_path = public
as $$
  with dias as (
    select g::date as fecha from generate_series(p_desde, p_hasta, interval '1 day') g
  ),
  obj_celdas as (
    select
      dias.fecha,
      case
        when o.tipo in ('NUMERIC', 'DURATION') and o.meta_valor > 0
          then least(1, coalesce(r.valor, 0) / o.meta_valor)
        when coalesce(r.completado, false) then 1
        else 0
      end as credito
    from dias
    join objetivo o
      on o.id_usuario = auth.uid()
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
  ),
  tar_celdas as (
    select
      t.fecha_limite::date as fecha,
      (case when t.completada then 1 else 0 end)::numeric as credito
    from tarea t
    where t.id_usuario = auth.uid()
      and t.fecha_limite is not null
      and t.fecha_limite::date between p_desde and p_hasta
  ),
  todo as (
    select fecha, credito from obj_celdas
    union all
    select fecha, credito from tar_celdas
  )
  select
    dias.fecha,
    count(x.credito)::int                     as esperados,
    coalesce(sum(x.credito), 0)::numeric      as credito,
    coalesce(round(sum(x.credito) / nullif(count(x.credito), 0) * 100), 0) as pct
  from dias
  left join todo x on x.fecha = dias.fecha
  group by dias.fecha
  order by dias.fecha;
$$;
grant execute on function public.pct_dias_persona(date, date) to authenticated;

-- ---------- progreso_por_dia ahora REUSA la función canónica ----------
create or replace function progreso_por_dia(
  p_desde date,
  p_hasta date,
  p_tz    text default 'America/Argentina/Buenos_Aires'
)
returns table (fecha date, esperados int, credito numeric, pct numeric)
language sql stable
as $$
  select fecha, esperados, credito, pct from public.pct_dias_persona(p_desde, p_hasta);
$$;

-- ---------- evaluar_logros ahora REUSA la misma función canónica ----------
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
  v_esp    int;
  v_pct    numeric;
  v_es_hoy boolean := true;
  d        date;
  rec      record;
begin
  if v_uid is null then raise exception 'sin sesión'; end if;

  -- % por día de los últimos 60 días — de la función ÚNICA (objetivos + tareas). 🔒
  create temp table _dias on commit drop as
  select fecha, esperados, pct from public.pct_dias_persona(v_hoy - 59, v_hoy);

  -- Racha actual: días consecutivos con esperados>0 y pct >= 85, desde hoy hacia atrás.
  -- Igual que la racha visible: días sin objetivos y días CONGELADOS = neutrales; HOY incompleto
  -- NO corta (el día sigue en curso); un día PASADO por debajo del 85% sí corta.
  d := v_hoy;
  while d >= v_hoy - 59 loop
    if exists (select 1 from racha_congelada rc where rc.id_usuario = v_uid and rc.fecha = d) then
      v_es_hoy := false;
      d := d - 1;
      continue;
    end if;
    select esperados, pct into v_esp, v_pct from _dias where fecha = d;
    if coalesce(v_esp, 0) = 0 then
      null; -- día sin objetivos: neutral
    elsif coalesce(v_pct, 0) >= 85 then
      v_racha := v_racha + 1;
    elsif not v_es_hoy then
      exit; -- día pasado incompleto → corta la racha
    end if;
    -- (si es HOY y está incompleto: neutral, no corta)
    v_es_hoy := false;
    d := d - 1;
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
      insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
      select v_uid, dd.id_dragon, 0
      from dragon dd
      join dragon_regla_desbloqueo rr on rr.id_dragon = dd.id_dragon
      where dd.activo
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
