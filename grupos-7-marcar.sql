-- ============================================================
--  GRUPOS — Paso 7 (Fase 2.2): emoji + marcar cumplido + esperados por fecha
--  Corré este archivo COMPLETO en el SQL Editor de Supabase (después de 1..6).
--
--   · item_grupo gana columna `icono` (emoji por ítem)
--   · registro_grupo: qué se cumplió y qué día (por ítem y fecha)
--   · marcar_item_grupo(item, fecha, hecho) → valida permisos (asignado / admin / sin asignar)
--   · esperados_grupo(grupo, fecha)         → lo que toca ese día, con `mio` / `puedo_marcar` / `hecho`
-- ============================================================

-- Emoji por ítem
alter table item_grupo add column if not exists icono text;

-- crear_item_grupo ahora acepta `p_icono` (recreamos con el nuevo parámetro)
drop function if exists public.crear_item_grupo(uuid, text, text, text, int[], date, uuid);
create or replace function public.crear_item_grupo(
  p_grupo        uuid,
  p_titulo       text,
  p_tipo         text,
  p_frecuencia   text default null,
  p_dias         int[] default null,
  p_fecha_limite date default null,
  p_asignado     uuid default null,
  p_icono        text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_id  uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_miembro_grupo(p_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Falta el título'; end if;
  if p_asignado is not null and not exists (
    select 1 from miembro_grupo m where m.id_miembro = p_asignado and m.id_grupo = p_grupo
  ) then
    raise exception 'La persona asignada no es del grupo';
  end if;

  insert into item_grupo (id_grupo, titulo, tipo, frecuencia, dias, fecha_limite, id_miembro_asignado, creado_por, icono)
  values (p_grupo, trim(p_titulo),
          case when p_tipo = 'OBJETIVO' then 'OBJETIVO' else 'TAREA' end,
          case when p_tipo = 'OBJETIVO' then p_frecuencia else null end,
          case when p_tipo = 'OBJETIVO' and p_frecuencia = 'DIAS' then p_dias else null end,
          case when p_tipo = 'TAREA' then p_fecha_limite else null end,
          p_asignado, v_uid, p_icono)
  returning id_item into v_id;
  return v_id;
end;
$$;
grant execute on function public.crear_item_grupo(uuid, text, text, text, int[], date, uuid, text) to authenticated;

-- Cumplimientos (una fila por ítem y fecha; presente + hecho = cumplido ese día)
create table if not exists registro_grupo (
  id_registro uuid primary key default gen_random_uuid(),
  id_item     uuid not null references item_grupo(id_item) on delete cascade,
  fecha       date not null,
  hecho       boolean not null default true,
  marcado_por uuid references perfil(id_usuario) on delete set null,
  fecha_marca timestamptz not null default now(),
  unique (id_item, fecha)
);
create index if not exists idx_registro_grupo_item on registro_grupo(id_item);

alter table registro_grupo enable row level security;
drop policy if exists "registro_grupo_ver" on registro_grupo;
create policy "registro_grupo_ver" on registro_grupo for select
  using (exists (select 1 from item_grupo i where i.id_item = registro_grupo.id_item and es_miembro_grupo(i.id_grupo)));

-- Marcar/desmarcar un ítem en una fecha. Permisos: admin, o el asignado, o si está sin asignar.
create or replace function public.marcar_item_grupo(p_item uuid, p_fecha date, p_hecho boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
        v_asignado uuid;
        v_mio boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select id_grupo, id_miembro_asignado into v_grupo, v_asignado from item_grupo where id_item = p_item;
  if v_grupo is null then raise exception 'Ese ítem no existe'; end if;
  if not es_miembro_grupo(v_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;

  v_mio := v_asignado is not null and v_asignado in (
    select id_miembro from miembro_grupo where id_grupo = v_grupo and id_usuario = v_uid
  );
  if not (es_admin_grupo(v_grupo, v_uid) or v_asignado is null or v_mio) then
    raise exception 'Solo podés marcar lo que te toca a vos';
  end if;

  if p_hecho then
    insert into registro_grupo (id_item, fecha, hecho, marcado_por)
    values (p_item, p_fecha, true, v_uid)
    on conflict (id_item, fecha) do update set hecho = true, marcado_por = v_uid, fecha_marca = now();
  else
    delete from registro_grupo where id_item = p_item and fecha = p_fecha;
  end if;
end;
$$;
grant execute on function public.marcar_item_grupo(uuid, date, boolean) to authenticated;

-- Lo que "toca" un día: objetivos según su frecuencia + TODAS las tareas (hasta que se hagan).
-- Devuelve, por ítem: si es MÍO, si PUEDO marcarlo, y si está HECHO (ese día para objetivos; alguna vez para tareas).
create or replace function public.esperados_grupo(
  p_grupo uuid,
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (
  id_item uuid, titulo text, icono text, tipo text, frecuencia text, dias int[],
  id_miembro_asignado uuid, asignado_nombre text, mio boolean, puedo_marcar boolean, hecho boolean
)
language sql security definer set search_path = public stable
as $$
  select i.id_item, i.titulo, i.icono, i.tipo, i.frecuencia, i.dias,
         i.id_miembro_asignado,
         (select coalesce(
                   nullif(trim(p.nombre), ''),
                   nullif(trim(m.nombre_visible), ''),
                   nullif(split_part(u.email, '@', 1), ''),
                   'Miembro')
          from miembro_grupo m
          left join perfil p     on p.id_usuario = m.id_usuario
          left join auth.users u on u.id = m.id_usuario
          where m.id_miembro = i.id_miembro_asignado) as asignado_nombre,
         (i.id_miembro_asignado is not null and i.id_miembro_asignado in (
            select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid()
          )) as mio,
         (es_admin_grupo(p_grupo, auth.uid())
            or i.id_miembro_asignado is null
            or i.id_miembro_asignado in (
                 select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid()
               )) as puedo_marcar,
         (case when i.tipo = 'TAREA'
               then exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.hecho)
               else exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.fecha = p_fecha and r.hecho)
          end) as hecho
  from item_grupo i
  where i.id_grupo = p_grupo
    and es_miembro_grupo(p_grupo, auth.uid())
    and (
      i.tipo = 'TAREA'
      or (i.tipo = 'OBJETIVO' and i.frecuencia = 'DIARIA')
      or (i.tipo = 'OBJETIVO' and i.frecuencia = 'DIAS' and (extract(isodow from p_fecha)::int = any(i.dias)))
    )
  order by (i.tipo = 'OBJETIVO') desc, i.fecha_creacion asc;
$$;
grant execute on function public.esperados_grupo(uuid, date) to authenticated;
