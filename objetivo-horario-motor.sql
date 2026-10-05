-- ============================================================
--  OPCIÓN B — Historial de horarios (versiones) — PARTE 1: el MOTOR
--  Corré este archivo en el SQL Editor de Supabase.
--
--  Qué hace:
--   1. Tabla objetivo_horario: versiones de horario (desde qué fecha rige cada set de días).
--   2. Helper objetivo_toca_dia(objetivo, fecha): ¿tocaba ese día, según la versión vigente ese día?
--      Con FALLBACK: si el objetivo no tiene versiones, usa su config actual (comportamiento viejo)
--      → la transición no rompe nada.
--   3. Migración: crea la "Versión 1" de cada objetivo existente (sus días actuales, desde su inicio).
--   4. Reemplaza el bloque "¿toca este día?" por el helper en las 4 funciones del motor.
--
--  🔒 Con la migración, los números quedan IGUALES a los actuales. Recién cambian cuando se use
--  "de hoy en adelante" (eso es la PARTE 2, del cliente, que va después).
-- ============================================================

-- ---------- 1) Tabla de versiones de horario ----------
create table if not exists objetivo_horario (
  id_horario      uuid primary key default gen_random_uuid(),
  id_objetivo     uuid not null references objetivo(id_objetivo) on delete cascade,
  desde           date not null,                 -- rige desde esta fecha (inclusive)
  frecuencia_tipo frecuencia_tipo not null,      -- DAILY | SPECIFIC_DAYS (WEEKLY_COUNT no versiona días)
  dias            int[],                          -- ISO 1..7 para SPECIFIC_DAYS; null para DAILY
  fecha_creacion  timestamptz not null default now()
);
create index if not exists idx_objetivo_horario on objetivo_horario(id_objetivo, desde);

alter table objetivo_horario enable row level security;
drop policy if exists "objetivo_horario_propio" on objetivo_horario;
create policy "objetivo_horario_propio" on objetivo_horario
  for all using (
    exists (select 1 from objetivo o where o.id_objetivo = objetivo_horario.id_objetivo and o.id_usuario = auth.uid())
  ) with check (
    exists (select 1 from objetivo o where o.id_objetivo = objetivo_horario.id_objetivo and o.id_usuario = auth.uid())
  );

-- ---------- 2) Helper: ¿el objetivo "toca" en esa fecha? ----------
create or replace function public.objetivo_toca_dia(p_objetivo uuid, p_fecha date)
returns boolean
language sql stable
set search_path = public
as $$
  select case
    -- Si hay una versión de horario vigente ese día, la usamos.
    when exists (select 1 from objetivo_horario h where h.id_objetivo = p_objetivo and h.desde <= p_fecha) then (
      select case
        when h.frecuencia_tipo = 'DAILY' then true
        when h.frecuencia_tipo = 'SPECIFIC_DAYS' then extract(isodow from p_fecha)::int = any(h.dias)
        else false
      end
      from objetivo_horario h
      where h.id_objetivo = p_objetivo and h.desde <= p_fecha
      order by h.desde desc
      limit 1
    )
    -- FALLBACK (sin versiones): config actual del objetivo = comportamiento viejo.
    else (
      select case
        when o.frecuencia_tipo = 'DAILY' then true
        when o.frecuencia_tipo = 'SPECIFIC_DAYS' then exists (
          select 1 from objetivo_dia od
          where od.id_objetivo = o.id_objetivo and od.dia_semana = extract(isodow from p_fecha)::int
        )
        else false
      end
      from objetivo o where o.id_objetivo = p_objetivo
    )
  end;
$$;
grant execute on function public.objetivo_toca_dia(uuid, date) to authenticated;

-- ---------- 3) Migración: Versión 1 de cada objetivo existente ----------
insert into objetivo_horario (id_objetivo, desde, frecuencia_tipo, dias)
select
  o.id_objetivo,
  coalesce(o.fecha_inicio, o.fecha_creacion::date) as desde,
  o.frecuencia_tipo,
  case when o.frecuencia_tipo = 'SPECIFIC_DAYS'
       then (select array_agg(od.dia_semana order by od.dia_semana) from objetivo_dia od where od.id_objetivo = o.id_objetivo)
       else null end
from objetivo o
where o.frecuencia_tipo in ('DAILY', 'SPECIFIC_DAYS')
  and not exists (select 1 from objetivo_horario h where h.id_objetivo = o.id_objetivo);

-- ============================================================
--  4) Las 4 funciones del motor: el bloque "¿toca este día?" pasa a usar el helper.
--     Todo lo demás queda IGUAL.
-- ============================================================

-- 4.a) esperados_hoy
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
    o.id_objetivo, o.nombre, o.descripcion, o.tipo, o.frecuencia_tipo,
    o.meta_valor, o.unidad, o.id_categoria, o.hora_recordatorio,
    coalesce(r.completado, false) as completado,
    r.valor,
    coalesce(r.omitido, false)    as omitido
  from objetivo o
  cross join hoy
  left join registro_objetivo r
    on r.id_objetivo = o.id_objetivo and r.fecha = hoy.d
  where o.id_usuario = auth.uid()
    and o.activo
    and o.frecuencia_tipo in ('DAILY', 'SPECIFIC_DAYS')
    and o.fecha_inicio <= hoy.d
    and (o.fecha_fin is null or o.fecha_fin >= hoy.d)
    and coalesce(objetivo_toca_dia(o.id_objetivo, hoy.d), false)
  order by o.hora_recordatorio nulls last, o.nombre;
$$;

-- 4.b) pct_dias_persona (% del día = objetivos + tareas; lo usan Progreso y los logros)
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
     and coalesce(objetivo_toca_dia(o.id_objetivo, dias.fecha), false)
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

-- 4.c) progreso_por_objetivo (% por categoría + grillas anuales)
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
    select d::date as fecha from generate_series(p_desde, p_hasta, interval '1 day') d
  ),
  celdas as (
    select
      o.id_objetivo, o.nombre, o.id_categoria, o.tipo,
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
     and coalesce(objetivo_toca_dia(o.id_objetivo, dias.fecha), false)
    left join registro_objetivo r
      on r.id_objetivo = o.id_objetivo and r.fecha = dias.fecha
    where not coalesce(r.omitido, false)
  )
  select
    id_objetivo, nombre, id_categoria, tipo,
    count(*)::int                        as esperados,
    coalesce(sum(credito), 0)::numeric   as credito,
    coalesce(round(sum(credito) / nullif(count(*), 0) * 100), 0) as pct
  from celdas
  group by id_objetivo, nombre, id_categoria, tipo
  order by nombre;
$$;

-- 4.d) detalle_dia (detalle al tocar un día del calendario) — objetivos + tareas
drop function if exists detalle_dia(date);
create or replace function detalle_dia(p_fecha date)
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
    o.id_objetivo, o.nombre, o.tipo, o.meta_valor, o.unidad, r.valor,
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
    and coalesce(objetivo_toca_dia(o.id_objetivo, p_fecha), false)
  union all
  -- Tareas que vencen ese día (Sí/No). Se muestran junto a los objetivos del día.
  select
    t.id_tarea, t.titulo, 'BOOLEAN'::tipo_objetivo, null::numeric, null::text,
    null::numeric,
    t.completada,
    false, null::text,
    (case when t.completada then 1 else 0 end)::numeric
  from tarea t
  where t.id_usuario = auth.uid()
    and t.fecha_limite is not null
    and t.fecha_limite::date = p_fecha
  order by nombre;
$$;
