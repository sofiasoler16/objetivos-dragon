-- ============================================================
--  FUNCIONES RPC — Pantalla "Progreso"  (Fase 8) 🔒
--  TODO se calcula desde `registro_objetivo` (la fuente de verdad),
--  NUNCA del estado actual del objetivo.
--
--  Crédito de un objetivo en un día (igual criterio que logic/hoy.ts):
--    · NUMERIC  → least(1, valor / meta)   (proporcional, tope 1)
--    · BOOLEAN  → 1 si completado, si no 0
--    · omitido  → queda FUERA (ni numerador ni denominador)
--  "Esperados" de un día = obligatorios (DAILY + SPECIFIC_DAYS que caen ese día),
--  activos y dentro de fecha_inicio/fecha_fin. WEEKLY_COUNT NO entra (no penaliza).
--
--  Consistencia del período = sum(credito) / sum(esperados).
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
    dias.fecha,
    count(c.id_objetivo)::int                         as esperados,
    coalesce(sum(c.credito), 0)::numeric              as credito,
    coalesce(
      round(sum(c.credito) / nullif(count(c.id_objetivo), 0) * 100),
      0
    )                                                 as pct
  from dias
  left join celdas c on c.fecha = dias.fecha
  group by dias.fecha
  order by dias.fecha;
$$;


-- Cumplimiento por objetivo en un rango (sección "por categoría" + desglose).
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
        when o.tipo = 'NUMERIC' and o.meta_valor > 0
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


-- Detalle de un día puntual (al tocar una celda del calendario).
create or replace function detalle_dia(
  p_fecha date
)
returns table (
  id_objetivo uuid,
  nombre      text,
  tipo        tipo_objetivo,
  meta_valor  numeric,
  unidad      text,
  valor       numeric,
  completado  boolean,
  omitido     boolean,
  credito     numeric
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
    case
      when coalesce(r.omitido, false) then 0
      when o.tipo = 'NUMERIC' and o.meta_valor > 0
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
  order by o.hora_recordatorio nulls last, o.nombre;
$$;
