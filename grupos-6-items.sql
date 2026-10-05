-- ============================================================
--  GRUPOS — Paso 6 (Fase 2.1): tareas y objetivos del grupo (crear + listar)
--  Corré este archivo COMPLETO en el SQL Editor de Supabase (después de 1..5).
--
--   · tabla item_grupo (una tarea u objetivo del grupo, asignado a alguien o no)
--   · crear_item_grupo(...) → cualquier MIEMBRO puede crear
--   · items_grupo(grupo)    → lista los ítems con el nombre de a quién está asignado
-- ============================================================

create table if not exists item_grupo (
  id_item             uuid primary key default gen_random_uuid(),
  id_grupo            uuid not null references grupo(id_grupo) on delete cascade,
  titulo              text not null,
  tipo                text not null default 'TAREA',   -- 'TAREA' (una vez) | 'OBJETIVO' (se repite)
  frecuencia          text,                            -- OBJETIVO: 'DIARIA' | 'DIAS'
  dias                int[],                            -- para 'DIAS' (ISO 1=lunes … 7=domingo)
  fecha_limite        date,                             -- para TAREA (opcional)
  id_miembro_asignado uuid references miembro_grupo(id_miembro) on delete set null, -- null = sin asignar
  creado_por          uuid references perfil(id_usuario) on delete set null,
  fecha_creacion      timestamptz not null default now()
);
create index if not exists idx_item_grupo_grupo on item_grupo(id_grupo);

alter table item_grupo enable row level security;
drop policy if exists "item_grupo_ver" on item_grupo;
create policy "item_grupo_ver" on item_grupo for select using (es_miembro_grupo(id_grupo));

-- Crear una tarea u objetivo del grupo. Cualquier miembro puede.
create or replace function public.crear_item_grupo(
  p_grupo        uuid,
  p_titulo       text,
  p_tipo         text,
  p_frecuencia   text default null,
  p_dias         int[] default null,
  p_fecha_limite date default null,
  p_asignado     uuid default null
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

  insert into item_grupo (id_grupo, titulo, tipo, frecuencia, dias, fecha_limite, id_miembro_asignado, creado_por)
  values (p_grupo, trim(p_titulo),
          case when p_tipo = 'OBJETIVO' then 'OBJETIVO' else 'TAREA' end,
          case when p_tipo = 'OBJETIVO' then p_frecuencia else null end,
          case when p_tipo = 'OBJETIVO' and p_frecuencia = 'DIAS' then p_dias else null end,
          case when p_tipo = 'TAREA' then p_fecha_limite else null end,
          p_asignado, v_uid)
  returning id_item into v_id;
  return v_id;
end;
$$;

-- Lista los ítems del grupo con el nombre de a quién está asignado (o null = sin asignar).
create or replace function public.items_grupo(p_grupo uuid)
returns table (
  id_item uuid, titulo text, tipo text, frecuencia text, dias int[], fecha_limite date,
  id_miembro_asignado uuid, asignado_nombre text
)
language sql security definer set search_path = public stable
as $$
  select i.id_item, i.titulo, i.tipo, i.frecuencia, i.dias, i.fecha_limite,
         i.id_miembro_asignado,
         (select coalesce(
                   nullif(trim(p.nombre), ''),
                   nullif(trim(m.nombre_visible), ''),
                   nullif(split_part(u.email, '@', 1), ''),
                   'Miembro')
          from miembro_grupo m
          left join perfil p     on p.id_usuario = m.id_usuario
          left join auth.users u on u.id = m.id_usuario
          where m.id_miembro = i.id_miembro_asignado) as asignado_nombre
  from item_grupo i
  where i.id_grupo = p_grupo and es_miembro_grupo(p_grupo, auth.uid())
  order by i.fecha_creacion desc;
$$;

grant execute on function public.crear_item_grupo(uuid, text, text, text, int[], date, uuid) to authenticated;
grant execute on function public.items_grupo(uuid) to authenticated;
