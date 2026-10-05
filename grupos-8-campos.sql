-- ============================================================
--  GRUPOS — Paso 8 (Fase 2): campos completos (como los personales, sin numérico/duración)
--  Corré este archivo COMPLETO en el SQL Editor de Supabase (después de 1..7).
--
--  item_grupo gana: fecha_inicio/fecha_fin + veces_semana (objetivos), hora_limite + prioridad (tareas),
--  descripcion (ambos). La frecuencia ahora admite 'SEMANAL' (X veces por semana).
--
--   · crear_item_grupo(...)          → con todos los campos
--   · esperados_grupo(grupo, fecha)   → objetivos DIARIA/DIAS + tareas (sin las SEMANAL)
--   · semanales_grupo(grupo, fecha)   → objetivos "X veces por semana", con hechos/meta de esa semana
-- ============================================================

alter table item_grupo add column if not exists fecha_inicio date;
alter table item_grupo add column if not exists fecha_fin    date;
alter table item_grupo add column if not exists hora_limite  text;   -- 'HH:MM' (tareas)
alter table item_grupo add column if not exists veces_semana int;    -- objetivos SEMANAL
alter table item_grupo add column if not exists prioridad    text;   -- tareas: 'BAJA'|'MEDIA'|'ALTA'
alter table item_grupo add column if not exists descripcion  text;

-- crear_item_grupo con todos los campos (limpiamos las firmas viejas para evitar ambigüedad).
drop function if exists public.crear_item_grupo(uuid, text, text, text, int[], date, uuid);
drop function if exists public.crear_item_grupo(uuid, text, text, text, int[], date, uuid, text);
drop function if exists public.crear_item_grupo(uuid, text, text, text, int[], date, uuid, text, date, date, text);
create or replace function public.crear_item_grupo(
  p_grupo        uuid,
  p_titulo       text,
  p_tipo         text,
  p_frecuencia   text default null,   -- OBJETIVO: 'DIARIA'|'DIAS'|'SEMANAL'
  p_dias         int[] default null,  -- 'DIAS'
  p_veces_semana int default null,    -- 'SEMANAL'
  p_fecha_inicio date default null,   -- OBJETIVO
  p_fecha_fin    date default null,   -- OBJETIVO
  p_fecha_limite date default null,   -- TAREA
  p_hora_limite  text default null,   -- TAREA
  p_prioridad    text default null,   -- TAREA
  p_descripcion  text default null,
  p_asignado     uuid default null,
  p_icono        text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_id  uuid;
        v_es_obj boolean := (p_tipo = 'OBJETIVO');
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_miembro_grupo(p_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Falta el título'; end if;
  if p_asignado is not null and not exists (
    select 1 from miembro_grupo m where m.id_miembro = p_asignado and m.id_grupo = p_grupo
  ) then
    raise exception 'La persona asignada no es del grupo';
  end if;

  insert into item_grupo (id_grupo, titulo, descripcion, tipo, frecuencia, dias, veces_semana,
                          fecha_inicio, fecha_fin, fecha_limite, hora_limite, prioridad,
                          id_miembro_asignado, creado_por, icono)
  values (p_grupo, trim(p_titulo), nullif(trim(coalesce(p_descripcion, '')), ''),
          case when v_es_obj then 'OBJETIVO' else 'TAREA' end,
          case when v_es_obj then p_frecuencia else null end,
          case when v_es_obj and p_frecuencia = 'DIAS' then p_dias else null end,
          case when v_es_obj and p_frecuencia = 'SEMANAL' then greatest(1, coalesce(p_veces_semana, 1)) else null end,
          case when v_es_obj then p_fecha_inicio else null end,
          case when v_es_obj then p_fecha_fin else null end,
          case when not v_es_obj then p_fecha_limite else null end,
          case when not v_es_obj then p_hora_limite else null end,
          case when not v_es_obj then coalesce(p_prioridad, 'MEDIA') else null end,
          p_asignado, v_uid, p_icono)
  returning id_item into v_id;
  return v_id;
end;
$$;
grant execute on function public.crear_item_grupo(uuid, text, text, text, int[], int, date, date, date, text, text, text, uuid, text) to authenticated;

-- Lo que "toca" un día: objetivos DIARIA/DIAS (respetando inicio/fin) + tareas. (Las SEMANAL van aparte.)
-- Se borra primero: cambia el tipo de retorno (agrega columnas) y `create or replace` no lo permite.
drop function if exists public.esperados_grupo(uuid, date);
create or replace function public.esperados_grupo(
  p_grupo uuid,
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (
  id_item uuid, titulo text, descripcion text, icono text, tipo text, frecuencia text, dias int[],
  fecha_limite date, hora_limite text, fecha_fin date, prioridad text,
  id_miembro_asignado uuid, asignado_nombre text, mio boolean, puedo_marcar boolean, hecho boolean,
  puedo_editar boolean
)
language sql security definer set search_path = public stable
as $$
  select i.id_item, i.titulo, i.descripcion, i.icono, i.tipo, i.frecuencia, i.dias,
         i.fecha_limite, i.hora_limite, i.fecha_fin, i.prioridad,
         i.id_miembro_asignado,
         (select coalesce(nullif(trim(p.nombre),''), nullif(trim(m.nombre_visible),''), nullif(split_part(u.email,'@',1),''), 'Miembro')
          from miembro_grupo m left join perfil p on p.id_usuario=m.id_usuario left join auth.users u on u.id=m.id_usuario
          where m.id_miembro = i.id_miembro_asignado) as asignado_nombre,
         (i.id_miembro_asignado is not null and i.id_miembro_asignado in (
            select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as mio,
         (es_admin_grupo(p_grupo, auth.uid()) or i.id_miembro_asignado is null
            or i.id_miembro_asignado in (select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as puedo_marcar,
         (case when i.tipo = 'TAREA'
               then exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.hecho)
               else exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.fecha = p_fecha and r.hecho)
          end) as hecho,
         (es_admin_grupo(p_grupo, auth.uid()) or i.creado_por = auth.uid()) as puedo_editar
  from item_grupo i
  where i.id_grupo = p_grupo and es_miembro_grupo(p_grupo, auth.uid())
    and (
      i.tipo = 'TAREA'
      or (i.tipo = 'OBJETIVO'
          and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
          and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
          and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and (extract(isodow from p_fecha)::int = any(i.dias)))))
    )
  order by (i.tipo = 'OBJETIVO') desc, i.fecha_creacion asc;
$$;
grant execute on function public.esperados_grupo(uuid, date) to authenticated;

-- Objetivos "X veces por semana": progreso de la semana que contiene p_fecha (lunes→domingo, ISO).
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
  )
  select i.id_item, i.titulo, i.descripcion, i.icono, coalesce(i.veces_semana, 1),
         i.id_miembro_asignado,
         (select coalesce(nullif(trim(p.nombre),''), nullif(trim(m.nombre_visible),''), nullif(split_part(u.email,'@',1),''), 'Miembro')
          from miembro_grupo m left join perfil p on p.id_usuario=m.id_usuario left join auth.users u on u.id=m.id_usuario
          where m.id_miembro = i.id_miembro_asignado) as asignado_nombre,
         (i.id_miembro_asignado is not null and i.id_miembro_asignado in (
            select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as mio,
         (es_admin_grupo(p_grupo, auth.uid()) or i.id_miembro_asignado is null
            or i.id_miembro_asignado in (select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as puedo_marcar,
         (select count(*)::int from registro_grupo r, sem
            where r.id_item = i.id_item and r.hecho and r.fecha between sem.lunes and sem.domingo) as hechos,
         exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.hecho and r.fecha = p_fecha) as hecho_fecha,
         (es_admin_grupo(p_grupo, auth.uid()) or i.creado_por = auth.uid()) as puedo_editar
  from item_grupo i
  where i.id_grupo = p_grupo and es_miembro_grupo(p_grupo, auth.uid())
    and i.tipo = 'OBJETIVO' and i.frecuencia = 'SEMANAL'
    and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
    and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
  order by i.fecha_creacion asc;
$$;
grant execute on function public.semanales_grupo(uuid, date) to authenticated;
