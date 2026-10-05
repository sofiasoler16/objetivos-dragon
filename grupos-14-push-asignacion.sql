-- ============================================================
--  GRUPOS — Paso 14 (Fase 4): notificación PUSH "te asignaron una tarea/objetivo"
--  Corré este archivo en el SQL Editor de Supabase (después de 1..13).
--
--  Requiere la extensión pg_net (para llamar al servicio de push de Expo desde la base).
--  Es GRATIS. Se activa acá abajo (o en Dashboard → Database → Extensions → "pg_net").
--
--   · push_token                → token de Expo por usuario/dispositivo (RLS: cada uno el suyo)
--   · registrar_push_token(t)   → la app guarda su token al abrir
--   · borrar_push_token(t)      → al cerrar sesión
--   · notificar_asignacion()    → trigger: al asignar un ítem a alguien, le manda la push
--
--  🔒 El push de Expo es gratis. El disparador usa pg_net (no cuenta como Edge Function).
--  Solo se dispara al ASIGNAR (evento raro), no en cada marcada. No se notifica a placeholders
--  (no tienen app) ni a vos mismo (si te asignás algo).
-- ============================================================

create extension if not exists pg_net;

-- Tabla de tokens de push (un usuario puede tener varios dispositivos).
create table if not exists push_token (
  id_usuario   uuid not null references perfil(id_usuario) on delete cascade,
  token        text not null,
  actualizado  timestamptz not null default now(),
  primary key (id_usuario, token)
);

alter table push_token enable row level security;
drop policy if exists "push_token_propio" on push_token;
create policy "push_token_propio" on push_token
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

-- La app guarda / actualiza su token al abrir.
create or replace function public.registrar_push_token(p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if coalesce(trim(p_token), '') = '' then return; end if;
  -- Si este token estaba asociado a OTRO usuario (mismo teléfono, otra cuenta), se lo sacamos.
  delete from push_token where token = p_token and id_usuario <> v_uid;
  insert into push_token (id_usuario, token, actualizado)
  values (v_uid, p_token, now())
  on conflict (id_usuario, token) do update set actualizado = now();
end;
$$;
grant execute on function public.registrar_push_token(text) to authenticated;

-- Al cerrar sesión, sacamos el token (para no seguir mandándole push a un teléfono deslogueado).
create or replace function public.borrar_push_token(p_token text)
returns void
language sql security definer set search_path = public
as $$
  delete from push_token where id_usuario = auth.uid() and token = p_token;
$$;
grant execute on function public.borrar_push_token(text) to authenticated;

-- Disparador: al crear/editar un ítem, si quedó asignado a un usuario real (distinto de quien asigna),
-- le mandamos una push por cada uno de sus tokens.
create or replace function public.notificar_asignacion()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_usuario uuid;
        v_grupo_nombre text;
        v_tipo_txt text;
        v_actor uuid := auth.uid();
        r record;
begin
  if new.id_miembro_asignado is null then return new; end if;
  -- En un UPDATE, solo notificamos si CAMBIÓ el asignado (no en cualquier edición).
  if tg_op = 'UPDATE' and new.id_miembro_asignado is not distinct from old.id_miembro_asignado then
    return new;
  end if;

  select id_usuario into v_usuario from miembro_grupo where id_miembro = new.id_miembro_asignado;
  if v_usuario is null then return new; end if;   -- placeholder: no tiene app
  if v_usuario = v_actor then return new; end if;  -- no te notifiques a vos mismo

  select nombre into v_grupo_nombre from grupo where id_grupo = new.id_grupo;
  v_tipo_txt := case when new.tipo = 'OBJETIVO' then 'un objetivo' else 'una tarea' end;

  for r in select token from push_token where id_usuario = v_usuario loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'to', r.token,
        'title', 'Te asignaron ' || v_tipo_txt,
        'body', coalesce(new.titulo, '') || ' · en ' || coalesce(v_grupo_nombre, 'tu grupo'),
        'channelId', 'default',
        'data', jsonb_build_object('tipo', 'asignacion_grupo', 'id_grupo', new.id_grupo)
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notificar_asignacion on item_grupo;
create trigger trg_notificar_asignacion
  after insert or update on item_grupo
  for each row execute function public.notificar_asignacion();
