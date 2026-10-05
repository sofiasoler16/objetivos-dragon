-- ============================================================
--  GRUPOS — Paso 1: fundación (grupos + miembros)
--  Corré este archivo COMPLETO en el SQL Editor de Supabase.
--
--  Qué crea:
--   · tabla `grupo` y `miembro_grupo`
--   · seguridad (RLS): un usuario ve SOLO los grupos donde es miembro
--   · funciones: crear_grupo (requiere Premium), mis_grupos (listar los tuyos)
--
--  🔒 Igual que el resto: los datos se ESCRIBEN vía funciones SECURITY DEFINER
--  (no inserts directos del cliente). La RLS solo permite LEER lo de tus grupos.
-- ============================================================

-- ── Tablas ───────────────────────────────────────────────────────────────────
create table if not exists grupo (
  id_grupo       uuid primary key default gen_random_uuid(),
  nombre         text not null,
  icono          text,                    -- emoji opcional (🏠, ✈️, etc.)
  id_admin       uuid not null references perfil(id_usuario) on delete cascade,
  fecha_creacion timestamptz not null default now()
);

create table if not exists miembro_grupo (
  id_miembro     uuid primary key default gen_random_uuid(),
  id_grupo       uuid not null references grupo(id_grupo) on delete cascade,
  id_usuario     uuid references perfil(id_usuario) on delete cascade, -- null = placeholder (sin app)
  nombre_visible text,                     -- para placeholder o alias
  rol            text not null default 'MIEMBRO',   -- 'ADMIN' | 'MIEMBRO'
  es_placeholder boolean not null default false,
  fecha_creacion timestamptz not null default now()
);
create index if not exists idx_miembro_grupo_grupo   on miembro_grupo(id_grupo);
create index if not exists idx_miembro_grupo_usuario on miembro_grupo(id_usuario);

-- ── Helper de membresía (SECURITY DEFINER para evitar recursión en las policies) ─
-- 🔒 Las policies de miembro_grupo NO pueden consultar miembro_grupo directo (recursión
-- infinita). Esta función lee la membresía SALTEANDO la RLS y responde sí/no.
create or replace function public.es_miembro_grupo(p_grupo uuid, p_uid uuid default auth.uid())
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from miembro_grupo m
    where m.id_grupo = p_grupo and m.id_usuario = p_uid
  );
$$;

-- ── Seguridad (RLS): solo LECTURA, y solo si sos miembro del grupo ──────────────
alter table grupo         enable row level security;
alter table miembro_grupo enable row level security;

drop policy if exists "grupo_ver"   on grupo;
drop policy if exists "miembro_ver" on miembro_grupo;

create policy "grupo_ver"   on grupo         for select using (es_miembro_grupo(id_grupo));
create policy "miembro_ver" on miembro_grupo for select using (es_miembro_grupo(id_grupo));

-- ── Crear grupo (requiere Premium) → crea el grupo + al creador como ADMIN ───────
create or replace function public.crear_grupo(p_nombre text, p_icono text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_premium() then raise exception 'Necesitás Premium para crear un grupo'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El grupo necesita un nombre'; end if;

  insert into grupo (nombre, icono, id_admin)
  values (trim(p_nombre), p_icono, v_uid)
  returning id_grupo into v_grupo;

  insert into miembro_grupo (id_grupo, id_usuario, rol, es_placeholder)
  values (v_grupo, v_uid, 'ADMIN', false);

  return v_grupo;
end;
$$;

-- ── Listar MIS grupos (con si soy admin y cuántos miembros tiene) ────────────────
create or replace function public.mis_grupos()
returns table (id_grupo uuid, nombre text, icono text, es_admin boolean, cant_miembros bigint)
language sql security definer set search_path = public stable
as $$
  select g.id_grupo, g.nombre, g.icono,
         (g.id_admin = auth.uid())                                             as es_admin,
         (select count(*) from miembro_grupo m2 where m2.id_grupo = g.id_grupo) as cant_miembros
  from grupo g
  where es_miembro_grupo(g.id_grupo, auth.uid())
  order by g.fecha_creacion desc;
$$;

grant execute on function public.es_miembro_grupo(uuid, uuid) to authenticated;
grant execute on function public.crear_grupo(text, text)      to authenticated;
grant execute on function public.mis_grupos()                 to authenticated;
