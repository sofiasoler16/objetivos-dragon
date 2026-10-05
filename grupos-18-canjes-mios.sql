-- ============================================================
--  GRUPOS — Paso 18 (Fase 6.1): mis premios canjeados + recompensas de un solo canje
--  Corré este archivo en el SQL Editor de Supabase (después del 17).
--
--  Agrega:
--   · recompensa_grupo.unica  → si es true, la recompensa desaparece del catálogo al canjearla alguien.
--   · canje_grupo.usado/usado_en → el premio canjeado queda para el usuario hasta que lo marca "usado";
--     a los 3 días de usado se borra solo (para no acumular una lista infinita).
--   · mis_canjes_grupo(grupo)  → mis premios canjeados (purga los usados viejos al leer)
--   · marcar_canje_usado(canje) → marcar un premio mío como usado
--   · recompensas_grupo / crear_recompensa actualizados para manejar `unica`.
-- ============================================================

alter table recompensa_grupo add column if not exists unica    boolean not null default false;
alter table canje_grupo      add column if not exists usado    boolean not null default false;
alter table canje_grupo      add column if not exists usado_en timestamptz;

-- ---------- Catálogo (ahora informa si es de un solo canje) ----------
drop function if exists public.recompensas_grupo(uuid);
create or replace function public.recompensas_grupo(p_grupo uuid)
returns table (id_recompensa uuid, nombre text, costo int, unica boolean, puedo_borrar boolean)
language sql security definer set search_path = public stable as $$
  select r.id_recompensa, r.nombre, r.costo, r.unica,
         (es_admin_grupo(p_grupo, auth.uid()) or r.creada_por = auth.uid()) as puedo_borrar
  from recompensa_grupo r
  where r.id_grupo = p_grupo and r.activa and es_miembro_grupo(p_grupo, auth.uid())
  order by r.costo asc, r.fecha_creacion asc;
$$;
grant execute on function public.recompensas_grupo(uuid) to authenticated;

-- ---------- Crear recompensa (con opción "único") ----------
drop function if exists public.crear_recompensa(uuid, text, int);
create or replace function public.crear_recompensa(p_grupo uuid, p_nombre text, p_costo int, p_unica boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_id uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_admin_grupo(p_grupo, v_uid) then raise exception 'Solo el admin puede crear recompensas'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  if p_costo is null or p_costo <= 0 then raise exception 'El costo tiene que ser mayor a 0'; end if;
  insert into recompensa_grupo (id_grupo, nombre, costo, creada_por, unica)
  values (p_grupo, trim(p_nombre), p_costo, v_uid, coalesce(p_unica, false))
  returning id_recompensa into v_id;
  return v_id;
end;
$$;
grant execute on function public.crear_recompensa(uuid, text, int, boolean) to authenticated;

-- ---------- Canjear (si es única, la saca del catálogo) ----------
create or replace function public.canjear_recompensa(p_recompensa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_r recompensa_grupo;
        v_saldo int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_r from recompensa_grupo where id_recompensa = p_recompensa and activa for update;
  if v_r.id_recompensa is null then raise exception 'Esa recompensa ya no está disponible'; end if;
  if not es_miembro_grupo(v_r.id_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;
  select coalesce(sum(puntos), 0) into v_saldo
  from punto_grupo where id_grupo = v_r.id_grupo and id_usuario = v_uid;
  if v_saldo < v_r.costo then raise exception 'No te alcanzan los puntos'; end if;

  insert into canje_grupo (id_recompensa, id_grupo, id_usuario, nombre, costo)
  values (p_recompensa, v_r.id_grupo, v_uid, v_r.nombre, v_r.costo);
  insert into punto_grupo (id_grupo, id_usuario, puntos, motivo)
  values (v_r.id_grupo, v_uid, -v_r.costo, 'canje');

  if v_r.unica then
    update recompensa_grupo set activa = false where id_recompensa = p_recompensa;
  end if;
end;
$$;
grant execute on function public.canjear_recompensa(uuid) to authenticated;

-- ---------- Mis premios canjeados (purga los usados de +3 días al leer) ----------
create or replace function public.mis_canjes_grupo(p_grupo uuid)
returns table (id_canje uuid, nombre text, costo int, usado boolean, usado_en timestamptz, fecha_creacion timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  delete from canje_grupo c
   where c.id_usuario = auth.uid() and c.usado and c.usado_en < now() - interval '3 days';
  return query
    select c.id_canje, c.nombre, c.costo, c.usado, c.usado_en, c.fecha_creacion
    from canje_grupo c
    where c.id_grupo = p_grupo and c.id_usuario = auth.uid()
      and es_miembro_grupo(p_grupo, auth.uid())
    order by c.usado asc, c.fecha_creacion desc;
end;
$$;
grant execute on function public.mis_canjes_grupo(uuid) to authenticated;

-- ---------- Marcar un premio mío como usado ----------
create or replace function public.marcar_canje_usado(p_canje uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update canje_grupo set usado = true, usado_en = now()
  where id_canje = p_canje and id_usuario = auth.uid() and not usado;
end;
$$;
grant execute on function public.marcar_canje_usado(uuid) to authenticated;
