-- ============================================================
--  FUNCIONES RPC — Pantalla "Hoy"  (Fase 6 · + navegación de días, Fase 2 mejoras)
--  · esperados_hoy: objetivos obligatorios del día (DAILY + SPECIFIC_DAYS
--    que caen ese día) con su registro (para pintar estado y calcular %).
--  · semanales_hoy: objetivos WEEKLY_COUNT con lo hecho en la semana (lunes→).
--  "Hoy" y la semana se calculan en la zona horaria del usuario (no UTC).
--  NUEVO: `p_fecha` opcional → permite ver/mar­car otro día (anterior/siguiente).
--         Si `p_fecha` es NULL usa la fecha de hoy en la TZ (comportamiento original).
--  SECURITY INVOKER (default): corren con el usuario que llama → RLS aplica
--  y auth.uid() es la persona logueada.
-- ============================================================

-- Se elimina la versión vieja (1 argumento) para no dejar overloads colgando.
drop function if exists esperados_hoy(text);
drop function if exists semanales_hoy(text);

create or replace function esperados_hoy(
  p_tz text default 'America/Argentina/Buenos_Aires',
  p_fecha date default null
)
returns table (
  id_objetivo       uuid,
  nombre            text,
  descripcion       text,
  tipo              tipo_objetivo,
  frecuencia_tipo   frecuencia_tipo,
  meta_valor        numeric,
  unidad            text,
  id_categoria      uuid,
  hora_recordatorio time,
  completado        boolean,
  valor             numeric,
  omitido           boolean
)
language sql
stable
as $$
  with hoy as (
    select coalesce(p_fecha, (now() at time zone p_tz)::date) as d
  )
  select
    o.id_objetivo,
    o.nombre,
    o.descripcion,
    o.tipo,
    o.frecuencia_tipo,
    o.meta_valor,
    o.unidad,
    o.id_categoria,
    o.hora_recordatorio,
    coalesce(r.completado, false) as completado,
    r.valor,
    coalesce(r.omitido, false)    as omitido
  from objetivo o
  cross join hoy
  left join registro_objetivo r
    on r.id_objetivo = o.id_objetivo
   and r.fecha = hoy.d
  where o.id_usuario = auth.uid()
    and o.activo
    and o.fecha_inicio <= hoy.d
    and (o.fecha_fin is null or o.fecha_fin >= hoy.d)
    and (
      o.frecuencia_tipo = 'DAILY'
      or (
        o.frecuencia_tipo = 'SPECIFIC_DAYS'
        and exists (
          select 1 from objetivo_dia od
          where od.id_objetivo = o.id_objetivo
            and od.dia_semana = extract(isodow from hoy.d)
        )
      )
    )
  order by o.hora_recordatorio nulls last, o.nombre;
$$;


-- Cambió las columnas (tipo/unidad + meta/hechos numeric) → dropear antes.
drop function if exists semanales_hoy(text, date);

create or replace function semanales_hoy(
  p_tz text default 'America/Argentina/Buenos_Aires',
  p_fecha date default null
)
returns table (
  id_objetivo    uuid,
  nombre         text,
  id_categoria   uuid,
  tipo           tipo_objetivo,
  unidad         text,
  meta           numeric,
  hechos         numeric,
  completado_hoy boolean
)
language sql
stable
as $$
  with hoy as (
    select coalesce(p_fecha, (now() at time zone p_tz)::date) as d
  ),
  semana as (
    -- lunes de la semana del día (ISO): d - (isodow-1)
    select d, (d - ((extract(isodow from d)::int) - 1)) as inicio
    from hoy
  )
  select
    o.id_objetivo,
    o.nombre,
    o.id_categoria,
    o.tipo,
    o.unidad,
    case when o.tipo = 'BOOLEAN' then o.frecuencia_cantidad::numeric else o.meta_valor end as meta,
    case
      when o.tipo = 'BOOLEAN' then (
        select count(*)::numeric
        from registro_objetivo r
        where r.id_objetivo = o.id_objetivo
          and r.completado
          and r.fecha between semana.inicio and semana.inicio + 6
      )
      else (
        select coalesce(sum(r.valor), 0)
        from registro_objetivo r
        where r.id_objetivo = o.id_objetivo
          and r.fecha between semana.inicio and semana.inicio + 6
      )
    end as hechos,
    exists (
      select 1 from registro_objetivo r2
      where r2.id_objetivo = o.id_objetivo
        and r2.completado
        and r2.fecha = semana.d
    ) as completado_hoy
  from objetivo o
  cross join semana
  where o.id_usuario = auth.uid()
    and o.activo
    and o.frecuencia_tipo = 'WEEKLY_COUNT'
    and o.fecha_inicio <= semana.d
    and (o.fecha_fin is null or o.fecha_fin >= semana.d)
  order by o.nombre;
$$;
