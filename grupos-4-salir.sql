-- ============================================================
--  GRUPOS — Paso 4: sacar miembro / salir / eliminar grupo
--  Corré este archivo COMPLETO en el SQL Editor de Supabase (después de 1, 2 y 3).
--
--   · sacar_miembro(id_miembro) → el admin saca a un miembro (no a sí mismo)
--   · salir_grupo(grupo)        → un miembro (no admin) se va del grupo
--   · eliminar_grupo(grupo)     → el admin borra el grupo entero (cascada)
-- ============================================================

-- Sacar a un miembro del grupo. Solo el admin, y no se puede sacar al admin.
create or replace function public.sacar_miembro(p_id_miembro uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_m   miembro_grupo;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_m from miembro_grupo where id_miembro = p_id_miembro;
  if v_m.id_miembro is null then raise exception 'Ese miembro no existe'; end if;
  if not es_admin_grupo(v_m.id_grupo, v_uid) then raise exception 'Solo el admin puede sacar miembros'; end if;
  if v_m.rol = 'ADMIN' then raise exception 'No se puede sacar al admin'; end if;
  delete from miembro_grupo where id_miembro = p_id_miembro;
end;
$$;

-- Salir de un grupo (cualquier miembro que NO sea el admin).
create or replace function public.salir_grupo(p_grupo uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if es_admin_grupo(p_grupo, v_uid) then
    raise exception 'Sos el admin del grupo. Para irte, eliminá el grupo.';
  end if;
  delete from miembro_grupo where id_grupo = p_grupo and id_usuario = v_uid;
end;
$$;

-- Eliminar el grupo entero (solo admin). Borra miembros e invitaciones por cascada.
create or replace function public.eliminar_grupo(p_grupo uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not es_admin_grupo(p_grupo, v_uid) then raise exception 'Solo el admin puede eliminar el grupo'; end if;
  delete from grupo where id_grupo = p_grupo;
end;
$$;

grant execute on function public.sacar_miembro(uuid)  to authenticated;
grant execute on function public.salir_grupo(uuid)    to authenticated;
grant execute on function public.eliminar_grupo(uuid) to authenticated;
