-- ============================================================
--  GRUPOS — Paso 17 (Fase 6): puntos por cumplir + recompensas del grupo
--  Corré este archivo en el SQL Editor de Supabase (después de 1..13 y 16).
--
--  🔒 Decisiones (usuaria 2026-09-15):
--   · Puntos POR PRIORIDAD: tarea BAJA 10 / MEDIA 20 / ALTA 30; objetivo 10 (fijo).
--   · Solo el ADMIN crea recompensas.
--   · Canje DIRECTO (descuenta puntos, queda en historial; sin estado de "entregada").
--   · Puntos INDIVIDUALES por miembro. Otorgamiento SERVER-SIDE (trigger), idempotente por (ítem, fecha).
--
--  Beneficiario de los puntos: si el ítem está asignado → el asignado (si tiene cuenta; los placeholders
--  no acumulan). Si está sin asignar → quien lo marcó (marcado_por).
--
--   · punto_grupo       → libro mayor de puntos (+cumplimiento / −canje)
--   · recompensa_grupo  → catálogo de premios (nombre + costo), lo crea el admin
--   · canje_grupo       → historial de canjes (con nombre/costo congelados)
--   · trigger otorgar_puntos_grupo → suma/resta puntos al marcar/desmarcar
--   · mis_puntos_grupo / puntos_miembros_grupo / recompensas_grupo / crear_recompensa /
--     borrar_recompensa / canjear_recompensa
-- ============================================================

-- ---------- Tablas ----------
create table if not exists punto_grupo (
  id_movimiento  uuid primary key default gen_random_uuid(),
  id_grupo       uuid not null references grupo(id_grupo) on delete cascade,
  id_usuario     uuid not null references perfil(id_usuario) on delete cascade,
  puntos         int  not null,                 -- + cumplimiento, − canje
  motivo         text not null,                 -- 'cumplimiento' | 'canje'
  clave          text unique,                   -- idempotencia de cumplimientos ('item:{id}:{fecha}'); null en canjes
  fecha_creacion timestamptz not null default now()
);
create index if not exists idx_punto_grupo_saldo on punto_grupo(id_grupo, id_usuario);

create table if not exists recompensa_grupo (
  id_recompensa  uuid primary key default gen_random_uuid(),
  id_grupo       uuid not null references grupo(id_grupo) on delete cascade,
  nombre         text not null,
  costo          int  not null check (costo > 0),
  creada_por     uuid references perfil(id_usuario) on delete set null,
  activa         boolean not null default true,
  fecha_creacion timestamptz not null default now()
);
create index if not exists idx_recompensa_grupo on recompensa_grupo(id_grupo);

create table if not exists canje_grupo (
  id_canje       uuid primary key default gen_random_uuid(),
  id_recompensa  uuid references recompensa_grupo(id_recompensa) on delete set null,
  id_grupo       uuid not null references grupo(id_grupo) on delete cascade,
  id_usuario     uuid not null references perfil(id_usuario) on delete cascade,
  nombre         text not null,                 -- snapshot (por si se borra la recompensa)
  costo          int  not null,
  fecha_creacion timestamptz not null default now()
);
create index if not exists idx_canje_grupo on canje_grupo(id_grupo);

-- ---------- RLS: solo LEER lo de tus grupos; escribir va por las funciones/trigger (SECURITY DEFINER) ----------
alter table punto_grupo      enable row level security;
alter table recompensa_grupo enable row level security;
alter table canje_grupo      enable row level security;

drop policy if exists "punto_grupo_ver" on punto_grupo;
create policy "punto_grupo_ver" on punto_grupo for select using (es_miembro_grupo(id_grupo));
drop policy if exists "recompensa_grupo_ver" on recompensa_grupo;
create policy "recompensa_grupo_ver" on recompensa_grupo for select using (es_miembro_grupo(id_grupo));
drop policy if exists "canje_grupo_ver" on canje_grupo;
create policy "canje_grupo_ver" on canje_grupo for select using (es_miembro_grupo(id_grupo));

-- ---------- Puntos por prioridad ----------
create or replace function public.puntos_de_item(p_tipo text, p_prioridad text)
returns int language sql immutable as $$
  select case when p_tipo = 'OBJETIVO' then 10
              else case p_prioridad when 'ALTA' then 30 when 'MEDIA' then 20 else 10 end
         end;
$$;

-- ---------- Trigger: otorgar/revocar puntos al marcar/desmarcar ----------
create or replace function public.otorgar_puntos_grupo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item item_grupo;
        v_benef uuid;
        v_clave text;
begin
  if tg_op = 'DELETE' then
    delete from punto_grupo where clave = 'item:' || old.id_item || ':' || old.fecha;
    return old;
  end if;

  select * into v_item from item_grupo where id_item = new.id_item;
  if v_item.id_item is null then return new; end if;
  v_clave := 'item:' || new.id_item || ':' || new.fecha;

  if not new.hecho then
    delete from punto_grupo where clave = v_clave;   -- por si un update lo desmarca
    return new;
  end if;

  -- Beneficiario: asignado (si tiene cuenta) o quien marcó (si es sin asignar).
  if v_item.id_miembro_asignado is not null then
    select id_usuario into v_benef from miembro_grupo where id_miembro = v_item.id_miembro_asignado;
  else
    v_benef := new.marcado_por;
  end if;
  if v_benef is null then return new; end if;   -- placeholder sin cuenta → no acumula

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

-- Backfill: dar puntos por lo YA cumplido (idempotente).
insert into punto_grupo (id_grupo, id_usuario, puntos, motivo, clave)
select i.id_grupo,
       case when i.id_miembro_asignado is not null then ma.id_usuario else r.marcado_por end,
       puntos_de_item(i.tipo, i.prioridad),
       'cumplimiento',
       'item:' || r.id_item || ':' || r.fecha
from registro_grupo r
join item_grupo i on i.id_item = r.id_item
left join miembro_grupo ma on ma.id_miembro = i.id_miembro_asignado
where r.hecho
  and (case when i.id_miembro_asignado is not null then ma.id_usuario else r.marcado_por end) is not null
on conflict (clave) do nothing;

-- ---------- Lecturas ----------
-- Mi saldo de puntos en un grupo.
create or replace function public.mis_puntos_grupo(p_grupo uuid)
returns int language sql security definer set search_path = public stable as $$
  select coalesce(sum(puntos), 0)::int
  from punto_grupo where id_grupo = p_grupo and id_usuario = auth.uid();
$$;
grant execute on function public.mis_puntos_grupo(uuid) to authenticated;

-- Saldo de cada miembro (para un ranking). Placeholders no acumulan → 0.
create or replace function public.puntos_miembros_grupo(p_grupo uuid)
returns table (id_miembro uuid, nombre text, es_yo boolean, puntos int)
language sql security definer set search_path = public stable as $$
  select m.id_miembro,
         coalesce(nullif(trim(p.nombre), ''), nullif(trim(m.nombre_visible), ''),
                  nullif(split_part(u.email, '@', 1), ''), 'Miembro') as nombre,
         coalesce(m.id_usuario = auth.uid(), false) as es_yo,
         coalesce((select sum(pg.puntos) from punto_grupo pg
                   where pg.id_grupo = p_grupo and pg.id_usuario = m.id_usuario), 0)::int as puntos
  from miembro_grupo m
  left join perfil p     on p.id_usuario = m.id_usuario
  left join auth.users u on u.id = m.id_usuario
  where m.id_grupo = p_grupo and es_miembro_grupo(p_grupo, auth.uid())
  order by puntos desc, nombre;
$$;
grant execute on function public.puntos_miembros_grupo(uuid) to authenticated;

-- Catálogo de recompensas activas.
create or replace function public.recompensas_grupo(p_grupo uuid)
returns table (id_recompensa uuid, nombre text, costo int, puedo_borrar boolean)
language sql security definer set search_path = public stable as $$
  select r.id_recompensa, r.nombre, r.costo,
         (es_admin_grupo(p_grupo, auth.uid()) or r.creada_por = auth.uid()) as puedo_borrar
  from recompensa_grupo r
  where r.id_grupo = p_grupo and r.activa and es_miembro_grupo(p_grupo, auth.uid())
  order by r.costo asc, r.fecha_creacion asc;
$$;
grant execute on function public.recompensas_grupo(uuid) to authenticated;

-- ---------- Escrituras ----------
create or replace function public.crear_recompensa(p_grupo uuid, p_nombre text, p_costo int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_id uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_admin_grupo(p_grupo, v_uid) then raise exception 'Solo el admin puede crear recompensas'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  if p_costo is null or p_costo <= 0 then raise exception 'El costo tiene que ser mayor a 0'; end if;
  insert into recompensa_grupo (id_grupo, nombre, costo, creada_por)
  values (p_grupo, trim(p_nombre), p_costo, v_uid)
  returning id_recompensa into v_id;
  return v_id;
end;
$$;
grant execute on function public.crear_recompensa(uuid, text, int) to authenticated;

create or replace function public.borrar_recompensa(p_recompensa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_r recompensa_grupo;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_r from recompensa_grupo where id_recompensa = p_recompensa;
  if v_r.id_recompensa is null then raise exception 'Esa recompensa no existe'; end if;
  if not (es_admin_grupo(v_r.id_grupo, v_uid) or v_r.creada_por = v_uid) then
    raise exception 'No podés borrar esta recompensa';
  end if;
  update recompensa_grupo set activa = false where id_recompensa = p_recompensa;
end;
$$;
grant execute on function public.borrar_recompensa(uuid) to authenticated;

-- Canjear: descuenta puntos (si alcanzan) y guarda el canje. Directo, sin seguimiento.
create or replace function public.canjear_recompensa(p_recompensa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_r recompensa_grupo;
        v_saldo int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_r from recompensa_grupo where id_recompensa = p_recompensa and activa;
  if v_r.id_recompensa is null then raise exception 'Esa recompensa no existe'; end if;
  if not es_miembro_grupo(v_r.id_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;
  select coalesce(sum(puntos), 0) into v_saldo
  from punto_grupo where id_grupo = v_r.id_grupo and id_usuario = v_uid;
  if v_saldo < v_r.costo then raise exception 'No te alcanzan los puntos'; end if;

  insert into canje_grupo (id_recompensa, id_grupo, id_usuario, nombre, costo)
  values (p_recompensa, v_r.id_grupo, v_uid, v_r.nombre, v_r.costo);
  insert into punto_grupo (id_grupo, id_usuario, puntos, motivo)
  values (v_r.id_grupo, v_uid, -v_r.costo, 'canje');
end;
$$;
grant execute on function public.canjear_recompensa(uuid) to authenticated;
