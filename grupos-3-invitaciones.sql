-- ============================================================
--  GRUPOS — Paso 3: invitaciones por link + reclamar placeholder
--  Corré este archivo COMPLETO en el SQL Editor de Supabase
--  (después de grupos-1 y grupos-2).
--
--  Crea:
--   · tabla `invitacion_grupo` (código del link; opcionalmente atado a un placeholder)
--   · generar_invitacion(grupo, destino?) → admin+Premium; devuelve el CÓDIGO
--   · info_invitacion(codigo)             → datos del grupo/destino (para la pantalla de unirse)
--   · unirse_por_codigo(codigo)           → te suma al grupo, o RECLAMA el placeholder si el link
--                                            estaba atado a uno (tomás su lugar y su historial)
-- ============================================================

create table if not exists invitacion_grupo (
  id_invitacion      uuid primary key default gen_random_uuid(),
  id_grupo           uuid not null references grupo(id_grupo) on delete cascade,
  codigo             text not null unique,
  id_miembro_destino uuid references miembro_grupo(id_miembro) on delete cascade, -- placeholder a reclamar (opcional)
  creada_por         uuid not null references perfil(id_usuario) on delete cascade,
  fecha_creacion     timestamptz not null default now()
);
create index if not exists idx_invitacion_grupo on invitacion_grupo(id_grupo);

-- Solo las funciones (SECURITY DEFINER) tocan esta tabla → RLS activa sin policies = sin acceso directo.
alter table invitacion_grupo enable row level security;

-- Generar un link de invitación. Solo el admin (y Premium). `p_destino` = placeholder a reclamar (o null).
create or replace function public.generar_invitacion(p_grupo uuid, p_destino uuid default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_codigo text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_admin_grupo(p_grupo, v_uid) then raise exception 'Solo el admin puede invitar'; end if;
  if not es_premium() then raise exception 'Necesitás Premium para invitar'; end if;

  if p_destino is not null then
    if not exists (
      select 1 from miembro_grupo m
      where m.id_miembro = p_destino and m.id_grupo = p_grupo and m.es_placeholder and m.id_usuario is null
    ) then
      raise exception 'Ese lugar ya no está disponible';
    end if;
  end if;

  v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into invitacion_grupo (id_grupo, codigo, id_miembro_destino, creada_por)
  values (p_grupo, v_codigo, p_destino, v_uid);
  return v_codigo;
end;
$$;

-- Datos de una invitación (para mostrar "te uniste al grupo X (como Julieta)"). null = código inválido.
create or replace function public.info_invitacion(p_codigo text)
returns table (id_grupo uuid, grupo_nombre text, grupo_icono text, destino_nombre text)
language sql security definer set search_path = public stable
as $$
  select g.id_grupo, g.nombre, g.icono,
         (select m.nombre_visible from miembro_grupo m where m.id_miembro = i.id_miembro_destino)
  from invitacion_grupo i
  join grupo g on g.id_grupo = i.id_grupo
  where i.codigo = upper(trim(p_codigo));
$$;

-- Unirse por código. Si el link estaba atado a un placeholder libre → lo RECLAMA (tomás su lugar).
-- Si ya sos miembro, no duplica. Devuelve el id del grupo.
create or replace function public.unirse_por_codigo(p_codigo text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_inv invitacion_grupo;
        v_destino miembro_grupo;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_inv from invitacion_grupo where codigo = upper(trim(p_codigo));
  if v_inv.id_invitacion is null then raise exception 'Código inválido'; end if;

  -- ¿ya soy miembro? → devuelvo el grupo, sin duplicar
  if exists (select 1 from miembro_grupo m where m.id_grupo = v_inv.id_grupo and m.id_usuario = v_uid) then
    return v_inv.id_grupo;
  end if;

  -- Link atado a un placeholder → reclamarlo si sigue libre
  if v_inv.id_miembro_destino is not null then
    select * into v_destino from miembro_grupo where id_miembro = v_inv.id_miembro_destino;
    if v_destino.id_miembro is not null and v_destino.es_placeholder and v_destino.id_usuario is null then
      update miembro_grupo set id_usuario = v_uid, es_placeholder = false
      where id_miembro = v_inv.id_miembro_destino;
      return v_inv.id_grupo;
    end if;
    -- si ya fue reclamado, caigo a sumarte como miembro nuevo
  end if;

  insert into miembro_grupo (id_grupo, id_usuario, rol, es_placeholder)
  values (v_inv.id_grupo, v_uid, 'MIEMBRO', false);
  return v_inv.id_grupo;
end;
$$;

grant execute on function public.generar_invitacion(uuid, uuid) to authenticated;
grant execute on function public.info_invitacion(text)         to authenticated;
grant execute on function public.unirse_por_codigo(text)       to authenticated;
