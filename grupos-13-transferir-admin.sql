-- ============================================================
--  GRUPOS — Paso 13 (Fase 4): transferir el rol de admin a otro miembro
--  Corré este archivo en el SQL Editor de Supabase (después de 1..12).
--
--   · transferir_admin(id_miembro) → el admin actual pasa el rol de admin a otro miembro real
--     (no a un placeholder). El admin actual queda como MIEMBRO. Un grupo tiene UN solo admin.
-- ============================================================

create or replace function public.transferir_admin(p_id_miembro uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_m   miembro_grupo;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_m from miembro_grupo where id_miembro = p_id_miembro;
  if v_m.id_miembro is null then raise exception 'Ese miembro no existe'; end if;
  if not es_admin_grupo(v_m.id_grupo, v_uid) then raise exception 'Solo el admin puede transferir el rol'; end if;
  if v_m.es_placeholder or v_m.id_usuario is null then
    raise exception 'No podés hacer admin a alguien que todavía no tiene la app';
  end if;
  if v_m.rol = 'ADMIN' then raise exception 'Ese miembro ya es el admin'; end if;

  -- El nuevo pasa a ADMIN; el admin actual (yo, en ESTE grupo) pasa a MIEMBRO.
  update miembro_grupo set rol = 'ADMIN'   where id_miembro = p_id_miembro;
  update miembro_grupo set rol = 'MIEMBRO' where id_grupo = v_m.id_grupo and id_usuario = v_uid;
  -- 🔑 grupo.id_admin es la fuente de verdad de es_admin_grupo → hay que moverlo también.
  update grupo set id_admin = v_m.id_usuario where id_grupo = v_m.id_grupo;
end;
$$;
grant execute on function public.transferir_admin(uuid) to authenticated;
