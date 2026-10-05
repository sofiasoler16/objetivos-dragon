-- ============================================================
--  GRUPOS — Paso 21e (Tema 1): guardar / leer las asignaciones de un ítem
--  Corré este archivo al hacer el build (después de 21a..21d).
--
--   · set_asignaciones_item(item, [{id_miembro, dias}])  → reemplaza las asignaciones (admin o creador).
--       dias = null → todos los días del ítem; [1,2,..] ISO → solo esos días.  [] = sin asignar.
--   · asignaciones_item(item) → las asignaciones actuales (para precargar el form de editar).
--  Mantiene item_grupo.id_miembro_asignado en sync (único asignado → ese; si no → null) por compat.
-- ============================================================

create or replace function public.set_asignaciones_item(p_item uuid, p_asignaciones jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
        v_creador uuid;
        r jsonb;
        v_cant int;
        v_unico uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select id_grupo, creado_por into v_grupo, v_creador from item_grupo where id_item = p_item;
  if v_grupo is null then raise exception 'Ese ítem no existe'; end if;
  if not (es_admin_grupo(v_grupo, v_uid) or v_creador = v_uid) then
    raise exception 'No podés cambiar las asignaciones de este ítem';
  end if;

  delete from asignacion_item where id_item = p_item;

  for r in select * from jsonb_array_elements(coalesce(p_asignaciones, '[]'::jsonb)) loop
    if not exists (
      select 1 from miembro_grupo m
      where m.id_miembro = (r->>'id_miembro')::uuid and m.id_grupo = v_grupo
    ) then
      raise exception 'Un asignado no es del grupo';
    end if;
    insert into asignacion_item (id_item, id_miembro, dias)
    values (
      p_item,
      (r->>'id_miembro')::uuid,
      case when r->'dias' is null or r->'dias' = 'null'::jsonb then null
           else (select array_agg((v)::int) from jsonb_array_elements_text(r->'dias') v) end
    )
    on conflict (id_item, id_miembro) do update set dias = excluded.dias;
  end loop;

  -- Compat: id_miembro_asignado = único asignado, o null si son varios / ninguno.
  -- (Postgres no tiene min() para uuid, así que lo resolvemos sin agregación sobre el uuid.)
  select count(*) into v_cant from asignacion_item where id_item = p_item;
  if v_cant = 1 then
    select id_miembro into v_unico from asignacion_item where id_item = p_item;
  else
    v_unico := null;
  end if;
  update item_grupo set id_miembro_asignado = v_unico where id_item = p_item;
end;
$$;
grant execute on function public.set_asignaciones_item(uuid, jsonb) to authenticated;

create or replace function public.asignaciones_item(p_item uuid)
returns table (id_miembro uuid, dias int[])
language sql security definer set search_path = public stable as $$
  select a.id_miembro, a.dias
  from asignacion_item a
  join item_grupo i on i.id_item = a.id_item
  where a.id_item = p_item and es_miembro_grupo(i.id_grupo, auth.uid());
$$;
grant execute on function public.asignaciones_item(uuid) to authenticated;
