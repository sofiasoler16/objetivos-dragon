-- ============================================================
--  FUNCIONES RPC — Pantalla "Progreso"  (Fase 8 · + tareas en el %, Fase 2 mejoras) 🔒
--  El cumplimiento de OBJETIVOS se calcula desde `registro_objetivo` (fuente de verdad),
--  NUNCA del estado actual del objetivo.
--
--  Crédito de un ítem en un día (igual criterio que logic/hoy.ts):
--    · OBJETIVO NUMERIC  → least(1, valor / meta)   (proporcional, tope 1)
--    · OBJETIVO BOOLEAN  → 1 si completado, si no 0
--    · omitido           → queda FUERA (ni numerador ni denominador)
--    · TAREA que vence ese día → 1 si completada, si no 0 (cuenta como un ítem Sí/No)  ← NUEVO
--  "Esperados" de un día = obligatorios (DAILY + SPECIFIC_DAYS que caen ese día) + tareas que
--  vencen ese día. WEEKLY_COUNT NO entra (no penaliza).
--
--  Consistencia del período = sum(credito) / sum(esperados).
--  progreso_por_objetivo NO incluye tareas (es el desglose por objetivo/categoría).
--  SECURITY INVOKER (default): corre como el usuario → RLS + auth.uid().
-- ============================================================

-- Cumplimiento por día de un rango (calendario mensual, barras L→D, resumen semanal).
create or replace function progreso_por_dia(
  p_desde date,
  p_hasta date,
  p_tz    text default 'America/Argentina/Buenos_Aires'
)
returns table (
  fecha     date,
  esperados int,
  credito   numeric,
  pct       numeric
)
language sql
stable
as $$
  with dias as (
    select d::date as fecha
    from generate_series(p_desde, p_hasta, interval '1 day') d
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
    -- Las TAREAS que vencen ese día cuentan como un ítem Sí/No (hecha=1, pendiente=0).
    select
      t.fecha_limite::date                          as fecha,
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
    count(x.credito)::int                    as esperados,
    coalesce(sum(x.credito), 0)::numeric     as credito,
    coalesce(
      round(sum(x.credito) / nullif(count(x.credito), 0) * 100),
      0
    )                                        as pct
  from dias
  left join todo x on x.fecha = dias.fecha
  group by dias.fecha
  order by dias.fecha;
$$;


-- Cumplimiento por objetivo en un rango (sección "por categoría" + desglose). SOLO objetivos.
create or replace function progreso_por_objetivo(
  p_desde date,
  p_hasta date,
  p_tz    text default 'America/Argentina/Buenos_Aires'
)
returns table (
  id_objetivo  uuid,
  nombre       text,
  id_categoria uuid,
  tipo         tipo_objetivo,
  esperados    int,
  credito      numeric,
  pct          numeric
)
language sql
stable
as $$
  with dias as (
    select d::date as fecha
    from generate_series(p_desde, p_hasta, interval '1 day') d
  ),
  celdas as (
    select
      o.id_objetivo,
      o.nombre,
      o.id_categoria,
      o.tipo,
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
  )
  select
    id_objetivo,
    nombre,
    id_categoria,
    tipo,
    count(*)::int                        as esperados,
    coalesce(sum(credito), 0)::numeric   as credito,
    coalesce(round(sum(credito) / nullif(count(*), 0) * 100), 0) as pct
  from celdas
  group by id_objetivo, nombre, id_categoria, tipo
  order by nombre;
$$;


-- Detalle de un día puntual (al tocar una celda del calendario): objetivos + tareas del día.
-- (Se dropea antes porque cambió las columnas de retorno; create or replace no permite eso.)
drop function if exists detalle_dia(date);

create or replace function detalle_dia(
  p_fecha date
)
returns table (
  id_objetivo   uuid,
  nombre        text,
  tipo          tipo_objetivo,
  meta_valor    numeric,
  unidad        text,
  valor         numeric,
  completado    boolean,
  omitido       boolean,
  razon_omision text,
  credito       numeric
)
language sql
stable
as $$
  select
    o.id_objetivo,
    o.nombre,
    o.tipo,
    o.meta_valor,
    o.unidad,
    r.valor,
    coalesce(r.completado, false) as completado,
    coalesce(r.omitido, false)    as omitido,
    r.razon_omision,
    case
      when coalesce(r.omitido, false) then 0
      when o.tipo in ('NUMERIC', 'DURATION') and o.meta_valor > 0
        then least(1, coalesce(r.valor, 0) / o.meta_valor)
      when coalesce(r.completado, false) then 1
      else 0
    end as credito
  from objetivo o
  left join registro_objetivo r
    on r.id_objetivo = o.id_objetivo and r.fecha = p_fecha
  where o.id_usuario = auth.uid()
    and o.activo
    and o.frecuencia_tipo in ('DAILY', 'SPECIFIC_DAYS')
    and o.fecha_inicio <= p_fecha
    and (o.fecha_fin is null or o.fecha_fin >= p_fecha)
    and (
      o.frecuencia_tipo = 'DAILY'
      or exists (
        select 1 from objetivo_dia od
        where od.id_objetivo = o.id_objetivo
          and od.dia_semana = extract(isodow from p_fecha)
      )
    )
  union all
  -- Tareas que vencen ese día (Sí/No). Se muestran junto a los objetivos del día.
  select
    t.id_tarea,
    t.titulo,
    'BOOLEAN'::tipo_objetivo,
    null::numeric,
    null::text,
    null::numeric,
    t.completada,
    false,
    null::text,
    (case when t.completada then 1 else 0 end)::numeric
  from tarea t
  where t.id_usuario = auth.uid()
    and t.fecha_limite is not null
    and t.fecha_limite::date = p_fecha
  order by nombre;
$$;
