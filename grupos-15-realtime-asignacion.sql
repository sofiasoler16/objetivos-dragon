-- ============================================================
--  GRUPOS — Paso 15 (Fase 4): aviso EN VIVO "te asignaron una tarea/objetivo" (Supabase Realtime)
--  Corré este archivo en el SQL Editor de Supabase (después de 1..13). NO necesita el 14 (push/FCM).
--
--  Con esto la app, mientras esté ABIERTA, se entera al instante cuando te asignan un ítem y te
--  muestra un aviso (no necesita Firebase/FCM). Si la app está cerrada, no suena — para eso sería push.
--
--   · Habilita Realtime en item_grupo (lo agrega a la publicación supabase_realtime).
--   · replica identity full → el evento incluye la fila vieja, para saber si CAMBIÓ el asignado.
--   · mis_membresias() → mis id_miembro por grupo (para reconocer qué asignaciones son para mí).
--
--  🔒 Realtime respeta RLS: cada quien solo recibe cambios de ítems de SUS grupos.
-- ============================================================

-- Habilitar Realtime en item_grupo (sin romper si ya estaba agregada).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_grupo'
  ) then
    execute 'alter publication supabase_realtime add table item_grupo';
  end if;
end $$;

-- Para que el evento de UPDATE traiga la fila vieja (y podamos ver si cambió el asignado).
alter table item_grupo replica identity full;

-- Mis membresías (un id_miembro por grupo donde estoy), con el nombre del grupo para el aviso.
create or replace function public.mis_membresias()
returns table (id_miembro uuid, id_grupo uuid, grupo_nombre text)
language sql security definer set search_path = public stable
as $$
  select m.id_miembro, m.id_grupo, g.nombre
  from miembro_grupo m
  join grupo g on g.id_grupo = m.id_grupo
  where m.id_usuario = auth.uid();
$$;
grant execute on function public.mis_membresias() to authenticated;
