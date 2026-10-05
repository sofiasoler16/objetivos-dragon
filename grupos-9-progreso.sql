-- ============================================================
--  GRUPOS — Paso 9 (Fase 2.3): progreso del día del grupo
--  Corré este archivo en el SQL Editor de Supabase (después de 1..8).
--
--   · progreso_grupo(grupo, fecha) → % del día del grupo sobre sus objetivos DIARIA/DIAS de ese día
--     (los "X veces por semana" y las tareas tienen su propio progreso aparte).
-- ============================================================

-- % del día = objetivos DIARIA/DIAS de ese día (hechos ese día) + TAREAS (hechas alguna vez).
-- Los "X veces por semana" tienen su propio progreso (van aparte).
create or replace function public.progreso_grupo(
  p_grupo uuid,
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (esperados int, hechos int, pct int)
language sql security definer set search_path = public stable
as $$
  with objs as (
    select i.id_item
    from item_grupo i
    where i.id_grupo = p_grupo
      and i.tipo = 'OBJETIVO'
      and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
      and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
      and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and (extract(isodow from p_fecha)::int = any(i.dias))))
  ),
  tareas as (
    select i.id_item from item_grupo i where i.id_grupo = p_grupo and i.tipo = 'TAREA'
  ),
  esp as (select ((select count(*) from objs) + (select count(*) from tareas))::int as n),
  hec as (
    select (
      (select count(*) from objs o
         where exists (select 1 from registro_grupo r where r.id_item = o.id_item and r.fecha = p_fecha and r.hecho))
      + (select count(*) from tareas t
         where exists (select 1 from registro_grupo r where r.id_item = t.id_item and r.hecho))
    )::int as n
  )
  select e.n as esperados,
         h.n as hechos,
         case when e.n > 0 then round(100.0 * h.n / e.n)::int else 0 end as pct
  from esp e, hec h
  where es_miembro_grupo(p_grupo, auth.uid());
$$;
grant execute on function public.progreso_grupo(uuid, date) to authenticated;
