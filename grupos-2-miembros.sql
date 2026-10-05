-- ============================================================
--  GRUPOS — Paso 2: detalle del grupo + miembros
--  Corré este archivo COMPLETO en el SQL Editor de Supabase
--  (después de grupos-1-fundacion.sql).
--
--  Crea:
--   · es_admin_grupo(grupo)         → ¿soy el admin de ese grupo?
--   · detalle_grupo(grupo)          → datos del grupo (nombre, ícono, si soy admin)
--   · miembros_grupo(grupo)         → lista de miembros (nombre, rol, si es placeholder)
--   · agregar_placeholder(grupo, n) → el admin suma un miembro "solo nombre" (sin app)
-- ============================================================

-- ¿Soy el admin (creador) de este grupo?
create or replace function public.es_admin_grupo(p_grupo uuid, p_uid uuid default auth.uid())
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from grupo g where g.id_grupo = p_grupo and g.id_admin = p_uid);
$$;

-- Datos del grupo (solo si sos miembro).
create or replace function public.detalle_grupo(p_grupo uuid)
returns table (id_grupo uuid, nombre text, icono text, es_admin boolean, cant_miembros bigint)
language sql security definer set search_path = public stable
as $$
  select g.id_grupo, g.nombre, g.icono,
         (g.id_admin = auth.uid()) as es_admin,
         (select count(*) from miembro_grupo m where m.id_grupo = g.id_grupo) as cant_miembros
  from grupo g
  where g.id_grupo = p_grupo and es_miembro_grupo(g.id_grupo, auth.uid());
$$;

-- Lista de miembros de un grupo (nombre visible, rol, si es placeholder, si soy yo).
-- El nombre cae en cascada: nombre del perfil → nombre visible (placeholder) → prefijo del email → 'Miembro'
-- (nullif descarta los textos vacíos, no solo los null).
create or replace function public.miembros_grupo(p_grupo uuid)
returns table (id_miembro uuid, nombre text, rol text, es_placeholder boolean, es_yo boolean)
language sql security definer set search_path = public stable
as $$
  select m.id_miembro,
         coalesce(
           nullif(trim(p.nombre), ''),
           nullif(trim(m.nombre_visible), ''),
           nullif(split_part(u.email, '@', 1), ''),
           'Miembro'
         )                                          as nombre,
         m.rol,
         m.es_placeholder,
         coalesce(m.id_usuario = auth.uid(), false) as es_yo
  from miembro_grupo m
  left join perfil p     on p.id_usuario = m.id_usuario
  left join auth.users u on u.id = m.id_usuario
  where m.id_grupo = p_grupo
    and es_miembro_grupo(p_grupo, auth.uid())   -- 🔒 solo si sos miembro del grupo
  order by (m.rol = 'ADMIN') desc, m.fecha_creacion asc;
$$;

-- Agregar un miembro "placeholder" (solo nombre, sin app). Solo el admin.
create or replace function public.agregar_placeholder(p_grupo uuid, p_nombre text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_id  uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_admin_grupo(p_grupo, v_uid) then raise exception 'Solo el admin puede agregar miembros'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;

  insert into miembro_grupo (id_grupo, id_usuario, nombre_visible, rol, es_placeholder)
  values (p_grupo, null, trim(p_nombre), 'MIEMBRO', true)
  returning id_miembro into v_id;
  return v_id;
end;
$$;

grant execute on function public.es_admin_grupo(uuid, uuid)     to authenticated;
grant execute on function public.detalle_grupo(uuid)            to authenticated;
grant execute on function public.miembros_grupo(uuid)           to authenticated;
grant execute on function public.agregar_placeholder(uuid, text) to authenticated;
