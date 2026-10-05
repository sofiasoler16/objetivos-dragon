-- ============================================================
--  GRUPOS — Paso 11: código de invitación ESTABLE (mismo código por grupo)
--  Corré este archivo en el SQL Editor de Supabase.
--  Reemplaza generar_invitacion: si ya hay una invitación para ese grupo (y ese destino),
--  devuelve el MISMO código en vez de crear uno nuevo cada vez. (Supersede a grupos-3.)
-- ============================================================

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

  -- Si ya existe una invitación para este grupo + destino, devolvemos ESE código (estable).
  -- `is not distinct from` hace que NULL = NULL (invitación genérica del grupo).
  select codigo into v_codigo
  from invitacion_grupo
  where id_grupo = p_grupo and id_miembro_destino is not distinct from p_destino
  order by fecha_creacion asc
  limit 1;
  if v_codigo is not null then return v_codigo; end if;

  -- Solo al CREAR una nueva validamos que el destino (placeholder) siga libre.
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
grant execute on function public.generar_invitacion(uuid, uuid) to authenticated;
