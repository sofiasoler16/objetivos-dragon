-- ============================================================
--  GRUPOS — Fix: nombre del miembro cuando el perfil no tiene nombre
--  Corré este archivo en el SQL Editor de Supabase. Reemplaza miembros_grupo:
--  si el perfil no tiene nombre, usa el nombre visible (placeholder) o el prefijo del email.
-- ============================================================

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
    and es_miembro_grupo(p_grupo, auth.uid())
  order by (m.rol = 'ADMIN') desc, m.fecha_creacion asc;
$$;
