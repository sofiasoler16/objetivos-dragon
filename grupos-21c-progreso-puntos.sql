-- ============================================================
--  GRUPOS — Paso 21c (Tema 1): % del día, progreso por miembro, puntos y semanales — POR PERSONA
--  Corré este archivo al hacer el build (después de 21a y 21b).
--
--   · progreso_grupo   → cada instancia (ítem×persona) cuenta por separado.
--   · progreso_miembros→ el % de cada uno según lo que le está asignado (nueva tabla).
--   · semanales_grupo  → "X veces por semana" por persona.
--   · otorgar_puntos_grupo (trigger) → puntos al dueño de CADA marca; clave idempotente por persona.
--   · recompute de los puntos ya ganados con la clave nueva (mismos totales).
-- ============================================================

-- ---------- % del día: cada (ítem × persona esperada) es una instancia ----------
create or replace function public.progreso_grupo(
  p_grupo uuid,
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (esperados int, hechos int, pct int)
language sql security definer set search_path = public stable
as $$
  with base as (
    select i.id_item, (i.tipo = 'TAREA') as es_tarea
    from item_grupo i
    where i.id_grupo = p_grupo
      and (
        i.tipo = 'TAREA'
        or (i.tipo = 'OBJETIVO'
            and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
            and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
            and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and (extract(isodow from p_fecha)::int = any(i.dias)))))
      )
  ),
  inst as (
    select b.id_item, b.es_tarea, me.id_miembro as miembro
    from base b join lateral public.miembros_esperados_item(b.id_item, p_fecha) me(id_miembro) on true
    union all
    select b.id_item, b.es_tarea, null::uuid
    from base b where not exists (select 1 from asignacion_item a where a.id_item = b.id_item)
  ),
  calc as (
    select
      count(*)::int as esperados,
      count(*) filter (where exists (
        select 1 from registro_grupo r
        where r.id_item = inst.id_item and r.hecho
          and r.id_miembro is not distinct from inst.miembro
          and (inst.es_tarea or r.fecha = p_fecha)
      ))::int as hechos
    from inst
  )
  select c.esperados, c.hechos,
         case when c.esperados > 0 then round(100.0 * c.hechos / c.esperados)::int else 0 end as pct
  from calc c
  where es_miembro_grupo(p_grupo, auth.uid());
$$;
grant execute on function public.progreso_grupo(uuid, date) to authenticated;

-- ---------- Progreso por miembro (día/semana/mes) sobre lo ASIGNADO a cada uno ----------
create or replace function public.progreso_miembros(
  p_grupo uuid, p_desde date, p_hasta date
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
           coalesce(nullif(trim(p.nombre), ''), nullif(trim(m.nombre_visible), ''),
                    nullif(split_part(u.email, '@', 1), ''), 'Miembro') as nombre,
           coalesce(m.id_usuario = auth.uid(), false) as es_yo
    from miembro_grupo m
    left join perfil p     on p.id_usuario = m.id_usuario
    left join auth.users u on u.id = m.id_usuario
    where m.id_grupo = p_grupo
  ),
  -- (A) Objetivos DIARIA/DIAS asignados a cada miembro, por día que le toca.
  obj_asig as (
    select mm.id_miembro,
      count(*)::int as esp,
      count(*) filter (where exists (
        select 1 from registro_grupo r where r.id_item = i.id_item and r.fecha = dd.dia and r.hecho and r.id_miembro = mm.id_miembro
      ))::int as hec
    from miembros mm
    join item_grupo i on i.id_grupo = p_grupo and i.tipo = 'OBJETIVO'
    join dias dd
      on (i.fecha_inicio is null or i.fecha_inicio <= dd.dia)
     and (i.fecha_fin is null or i.fecha_fin >= dd.dia)
     and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and extract(isodow from dd.dia)::int = any(i.dias)))
    where exists (
      select 1 from asignacion_item a
      where a.id_item = i.id_item and a.id_miembro = mm.id_miembro
        and (a.dias is null or extract(isodow from dd.dia)::int = any(a.dias))
    )
    group by mm.id_miembro
  ),
  -- (B) Tareas asignadas con vencimiento en el rango.
  tar_asig as (
    select mm.id_miembro,
      count(*)::int as esp,
      count(*) filter (where exists (
        select 1 from registro_grupo r where r.id_item = i.id_item and r.hecho and r.id_miembro = mm.id_miembro
      ))::int as hec
    from miembros mm
    join item_grupo i on i.id_grupo = p_grupo and i.tipo = 'TAREA'
       and i.fecha_limite is not null and i.fecha_limite between p_desde and p_hasta
    where exists (select 1 from asignacion_item a where a.id_item = i.id_item and a.id_miembro = mm.id_miembro)
    group by mm.id_miembro
  ),
  -- (C) Ítems SIN asignar que el miembro completó en el rango (bonus: +1 esp y +1 hecho).
  sin_asig as (
    select mm.id_miembro, count(*)::int as n
    from miembros mm
    join registro_grupo r on r.marcado_por = mm.id_usuario and r.hecho and r.id_miembro is null and r.fecha between p_desde and p_hasta
    join item_grupo i on i.id_item = r.id_item and i.id_grupo = p_grupo
    where mm.id_usuario is not null
      and not exists (select 1 from asignacion_item a where a.id_item = i.id_item)
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

-- ---------- "X veces por semana" por persona ----------
drop function if exists public.semanales_grupo(uuid, date);
create or replace function public.semanales_grupo(
  p_grupo uuid,
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (
  id_item uuid, titulo text, descripcion text, icono text, veces_semana int,
  id_miembro_asignado uuid, asignado_nombre text, mio boolean, puedo_marcar boolean,
  hechos int, hecho_fecha boolean, puedo_editar boolean
)
language sql security definer set search_path = public stable
as $$
  with sem as (
    select (p_fecha - ((extract(isodow from p_fecha)::int) - 1))::date as lunes,
           (p_fecha - ((extract(isodow from p_fecha)::int) - 1) + 6)::date as domingo
  ),
  base as (
    select i.* from item_grupo i
    where i.id_grupo = p_grupo and i.tipo = 'OBJETIVO' and i.frecuencia = 'SEMANAL'
      and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
      and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
  ),
  filas as (
    select b.*, a.id_miembro as fila_miembro
    from base b join asignacion_item a on a.id_item = b.id_item
    union all
    select b.*, null::uuid
    from base b where not exists (select 1 from asignacion_item a where a.id_item = b.id_item)
  )
  select f.id_item, f.titulo, f.descripcion, f.icono, coalesce(f.veces_semana, 1),
         f.fila_miembro as id_miembro_asignado,
         (select coalesce(nullif(trim(p.nombre),''), nullif(trim(m.nombre_visible),''), nullif(split_part(u.email,'@',1),''), 'Miembro')
          from miembro_grupo m left join perfil p on p.id_usuario=m.id_usuario left join auth.users u on u.id=m.id_usuario
          where m.id_miembro = f.fila_miembro) as asignado_nombre,
         (f.fila_miembro is not null and f.fila_miembro in (
            select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as mio,
         (es_admin_grupo(p_grupo, auth.uid()) or f.fila_miembro is null
            or f.fila_miembro in (select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as puedo_marcar,
         (select count(*)::int from registro_grupo r, sem
            where r.id_item = f.id_item and r.hecho and r.id_miembro is not distinct from f.fila_miembro
              and r.fecha between sem.lunes and sem.domingo) as hechos,
         exists (select 1 from registro_grupo r where r.id_item = f.id_item and r.hecho
                   and r.id_miembro is not distinct from f.fila_miembro and r.fecha = p_fecha) as hecho_fecha,
         (es_admin_grupo(p_grupo, auth.uid()) or f.creado_por = auth.uid()) as puedo_editar
  from filas f
  where es_miembro_grupo(p_grupo, auth.uid())
  order by f.fecha_creacion asc, asignado_nombre asc;
$$;
grant execute on function public.semanales_grupo(uuid, date) to authenticated;

-- ---------- Puntos: al dueño de CADA marca; clave idempotente por persona ----------
create or replace function public.otorgar_puntos_grupo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item item_grupo;
        v_benef uuid;
        v_clave text;
begin
  if tg_op = 'DELETE' then
    delete from punto_grupo where clave = 'item:' || old.id_item || ':' || old.fecha || ':' || coalesce(old.id_miembro::text, 'x');
    return old;
  end if;

  select * into v_item from item_grupo where id_item = new.id_item;
  if v_item.id_item is null then return new; end if;
  v_clave := 'item:' || new.id_item || ':' || new.fecha || ':' || coalesce(new.id_miembro::text, 'x');

  if not new.hecho then
    delete from punto_grupo where clave = v_clave;
    return new;
  end if;

  -- Beneficiario: el dueño de la marca (id_miembro); si es compartida, quien la marcó.
  if new.id_miembro is not null then
    select id_usuario into v_benef from miembro_grupo where id_miembro = new.id_miembro;
  else
    v_benef := new.marcado_por;
  end if;
  if v_benef is null then return new; end if;  -- placeholder sin cuenta → no acumula

  insert into punto_grupo (id_grupo, id_usuario, puntos, motivo, clave)
  values (v_item.id_grupo, v_benef, puntos_de_item(v_item.tipo, v_item.prioridad), 'cumplimiento', v_clave)
  on conflict (clave) do update set id_usuario = excluded.id_usuario, puntos = excluded.puntos;
  return new;
end;
$$;

drop trigger if exists trg_puntos_grupo on registro_grupo;
create trigger trg_puntos_grupo
  after insert or update or delete on registro_grupo
  for each row execute function public.otorgar_puntos_grupo();

-- Recompute de los puntos ya ganados con la clave NUEVA (mismos totales; los canjes no se tocan).
delete from punto_grupo where motivo = 'cumplimiento';
insert into punto_grupo (id_grupo, id_usuario, puntos, motivo, clave)
select i.id_grupo,
       coalesce(mm.id_usuario, r.marcado_por),
       puntos_de_item(i.tipo, i.prioridad),
       'cumplimiento',
       'item:' || r.id_item || ':' || r.fecha || ':' || coalesce(r.id_miembro::text, 'x')
from registro_grupo r
join item_grupo i on i.id_item = r.id_item
left join miembro_grupo mm on mm.id_miembro = r.id_miembro
where r.hecho
  and coalesce(mm.id_usuario, r.marcado_por) is not null
on conflict (clave) do nothing;
