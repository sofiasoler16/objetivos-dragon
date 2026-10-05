-- ============================================================
--  GRUPOS — Paso 16 (Fase 5): progreso del grupo POR MIEMBRO en un rango (día/semana/mes)
--  Corré este archivo en el SQL Editor de Supabase (después de 1..13).
--
--   · progreso_miembros(grupo, desde, hasta) → una fila por miembro con esperados/hechos/% del rango.
--
--  🔒 Decisiones (elegidas por la usuaria 2026-09-15):
--   1. El % de cada miembro se calcula SOLO sobre lo que le está ASIGNADO.
--   2. Los ítems SIN asignar cuentan al % de QUIEN los hizo (marcado_por), como bonus (+1 esp y +1 hecho).
--   3. Los placeholders (sin app) se muestran (su progreso sale de lo que el admin marca por ellos).
--
--  Criterio de crédito (igual que el % del día del grupo):
--   · Objetivos DIARIA/DIAS asignados → una ocurrencia por cada día del rango en que "tocan".
--   · Tareas asignadas con vencimiento dentro del rango → una unidad (hecha si tiene registro).
--   · "X veces por semana" (SEMANAL) queda fuera (tiene su propio conteo aparte), igual que en progreso_grupo.
--   · Ítems sin asignar completados por el miembro en el rango → +1 esperado y +1 hecho (nunca penaliza).
-- ============================================================

create or replace function public.progreso_miembros(
  p_grupo uuid,
  p_desde date,
  p_hasta date
)
returns table (
  id_miembro uuid, nombre text, es_placeholder boolean, es_yo boolean,
  esperados int, hechos int, pct int
)
language sql security definer set search_path = public stable
as $$
  with dias as (
    select d::date as dia from generate_series(p_desde, p_hasta, interval '1 day') d
  ),
  miembros as (
    select m.id_miembro, m.id_usuario, m.es_placeholder,
           coalesce(
             nullif(trim(p.nombre), ''),
             nullif(trim(m.nombre_visible), ''),
             nullif(split_part(u.email, '@', 1), ''),
             'Miembro'
           ) as nombre,
           coalesce(m.id_usuario = auth.uid(), false) as es_yo
    from miembro_grupo m
    left join perfil p     on p.id_usuario = m.id_usuario
    left join auth.users u on u.id = m.id_usuario
    where m.id_grupo = p_grupo
  ),
  -- (A) Objetivos DIARIA/DIAS asignados a cada miembro, una ocurrencia por día que "toca".
  obj_asig as (
    select mm.id_miembro,
      count(*)::int as esp,
      count(*) filter (where exists (
        select 1 from registro_grupo r where r.id_item = i.id_item and r.fecha = dd.dia and r.hecho
      ))::int as hec
    from miembros mm
    join item_grupo i
      on i.id_grupo = p_grupo and i.tipo = 'OBJETIVO' and i.id_miembro_asignado = mm.id_miembro
    join dias dd
      on (i.fecha_inicio is null or i.fecha_inicio <= dd.dia)
     and (i.fecha_fin is null or i.fecha_fin >= dd.dia)
     and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and extract(isodow from dd.dia)::int = any(i.dias)))
    group by mm.id_miembro
  ),
  -- (B) Tareas asignadas con vencimiento dentro del rango.
  tar_asig as (
    select mm.id_miembro,
      count(*)::int as esp,
      count(*) filter (where exists (
        select 1 from registro_grupo r where r.id_item = i.id_item and r.hecho
      ))::int as hec
    from miembros mm
    join item_grupo i
      on i.id_grupo = p_grupo and i.tipo = 'TAREA' and i.id_miembro_asignado = mm.id_miembro
     and i.fecha_limite is not null and i.fecha_limite between p_desde and p_hasta
    group by mm.id_miembro
  ),
  -- (C) Ítems SIN asignar que el miembro completó en el rango (bonus: +1 esperado y +1 hecho).
  sin_asig as (
    select mm.id_miembro, count(*)::int as n
    from miembros mm
    join registro_grupo r
      on r.marcado_por = mm.id_usuario and r.hecho and r.fecha between p_desde and p_hasta
    join item_grupo i
      on i.id_item = r.id_item and i.id_grupo = p_grupo and i.id_miembro_asignado is null
    where mm.id_usuario is not null
    group by mm.id_miembro
  )
  select mm.id_miembro, mm.nombre, mm.es_placeholder, mm.es_yo,
    (coalesce(oa.esp,0) + coalesce(ta.esp,0) + coalesce(sa.n,0)) as esperados,
    (coalesce(oa.hec,0) + coalesce(ta.hec,0) + coalesce(sa.n,0)) as hechos,
    case when (coalesce(oa.esp,0) + coalesce(ta.esp,0) + coalesce(sa.n,0)) > 0
         then round(100.0 * (coalesce(oa.hec,0) + coalesce(ta.hec,0) + coalesce(sa.n,0))
                          / (coalesce(oa.esp,0) + coalesce(ta.esp,0) + coalesce(sa.n,0)))::int
         else 0 end as pct
  from miembros mm
  left join obj_asig oa on oa.id_miembro = mm.id_miembro
  left join tar_asig ta on ta.id_miembro = mm.id_miembro
  left join sin_asig sa on sa.id_miembro = mm.id_miembro
  where es_miembro_grupo(p_grupo, auth.uid())
  order by hechos desc, mm.nombre;
$$;
grant execute on function public.progreso_miembros(uuid, date, date) to authenticated;
