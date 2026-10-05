-- ============================================================
--  GRUPOS — Paso 21b (Tema 1): marca por persona + esperados_grupo por persona
--  Corré este archivo al hacer el build (después de 21a).
--
--   · Cambia la unicidad de registro_grupo a "por persona" (índices parciales).
--   · marcar_item_grupo (3 args, la que usa la app actual): AUTODETECTA para quién es la marca
--     (sin asignar → compartida; me toca → mía; único asignado → ese). Retrocompatible.
--   · marcar_item_miembro (4 args, para la app nueva): marca para un miembro específico.
--   · esperados_grupo: ahora devuelve UNA FILA POR PERSONA esperada. Para ítems de 1 dueño o sin
--     asignar devuelve exactamente lo mismo que antes (misma cantidad de filas y columnas).
-- ============================================================

-- ---------- Unicidad por persona ----------
alter table registro_grupo drop constraint if exists registro_grupo_id_item_fecha_key;
create unique index if not exists uq_registro_grupo_miembro
  on registro_grupo (id_item, fecha, id_miembro) where id_miembro is not null;
create unique index if not exists uq_registro_grupo_compartido
  on registro_grupo (id_item, fecha) where id_miembro is null;

-- ---------- Escritura interna de una marca (no expuesta al cliente) ----------
create or replace function public._registrar_marca(
  p_item uuid, p_fecha date, p_miembro uuid, p_hecho boolean, p_marcador uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_hecho then
    if p_miembro is null then
      insert into registro_grupo (id_item, fecha, hecho, marcado_por, id_miembro)
      values (p_item, p_fecha, true, p_marcador, null)
      on conflict (id_item, fecha) where id_miembro is null
        do update set hecho = true, marcado_por = p_marcador, fecha_marca = now();
    else
      insert into registro_grupo (id_item, fecha, hecho, marcado_por, id_miembro)
      values (p_item, p_fecha, true, p_marcador, p_miembro)
      on conflict (id_item, fecha, id_miembro) where id_miembro is not null
        do update set hecho = true, marcado_por = p_marcador, fecha_marca = now();
    end if;
  else
    if p_miembro is null then
      delete from registro_grupo where id_item = p_item and fecha = p_fecha and id_miembro is null;
    else
      delete from registro_grupo where id_item = p_item and fecha = p_fecha and id_miembro = p_miembro;
    end if;
  end if;
end;
$$;

-- ---------- marcar_item_grupo (3 args) — autodetecta el miembro. Retrocompatible con la app actual ----------
create or replace function public.marcar_item_grupo(p_item uuid, p_fecha date, p_hecho boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
        v_yo uuid;
        v_miembro uuid;
        v_cant int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select id_grupo into v_grupo from item_grupo where id_item = p_item;
  if v_grupo is null then raise exception 'Ese ítem no existe'; end if;
  if not es_miembro_grupo(v_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;

  select id_miembro into v_yo from miembro_grupo where id_grupo = v_grupo and id_usuario = v_uid;
  select count(*) into v_cant from asignacion_item a where a.id_item = p_item;

  if v_cant = 0 then
    v_miembro := null;  -- sin asignar → marca compartida
  elsif v_yo is not null and exists (select 1 from asignacion_item a where a.id_item = p_item and a.id_miembro = v_yo) then
    v_miembro := v_yo;  -- me toca a mí
  elsif v_cant = 1 then
    select a.id_miembro into v_miembro from asignacion_item a where a.id_item = p_item;  -- único asignado
  else
    raise exception 'Elegí para quién marcar';  -- multi-asignado: la app nueva usa marcar_item_miembro
  end if;

  if not (es_admin_grupo(v_grupo, v_uid) or v_miembro is null or v_miembro = v_yo) then
    raise exception 'Solo podés marcar lo que te toca a vos';
  end if;

  perform public._registrar_marca(p_item, p_fecha, v_miembro, p_hecho, v_uid);
end;
$$;
grant execute on function public.marcar_item_grupo(uuid, date, boolean) to authenticated;

-- ---------- marcar_item_miembro (4 args) — marca para un miembro específico (app nueva) ----------
create or replace function public.marcar_item_miembro(
  p_item uuid, p_fecha date, p_id_miembro uuid, p_hecho boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
        v_yo uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select id_grupo into v_grupo from item_grupo where id_item = p_item;
  if v_grupo is null then raise exception 'Ese ítem no existe'; end if;
  if not es_miembro_grupo(v_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;

  select id_miembro into v_yo from miembro_grupo where id_grupo = v_grupo and id_usuario = v_uid;

  -- Permiso: admin, o es mi propia marca, o marca compartida de un ítem sin asignar.
  if not (
    es_admin_grupo(v_grupo, v_uid)
    or (p_id_miembro is not null and p_id_miembro = v_yo)
    or (p_id_miembro is null and not exists (select 1 from asignacion_item a where a.id_item = p_item))
  ) then
    raise exception 'Solo podés marcar lo que te toca a vos';
  end if;

  perform public._registrar_marca(p_item, p_fecha, p_id_miembro, p_hecho, v_uid);
end;
$$;
grant execute on function public.marcar_item_miembro(uuid, date, uuid, boolean) to authenticated;

-- ---------- esperados_grupo — UNA FILA POR PERSONA esperada ese día ----------
-- Para ítems de 1 dueño o sin asignar devuelve lo mismo que antes. `id_miembro_asignado` = el miembro
-- de ESA fila (null si es una marca compartida de ítem sin asignar).
drop function if exists public.esperados_grupo(uuid, date);
create or replace function public.esperados_grupo(
  p_grupo uuid,
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (
  id_item uuid, titulo text, descripcion text, icono text, tipo text, frecuencia text, dias int[],
  fecha_limite date, hora_limite text, fecha_fin date, prioridad text,
  id_miembro_asignado uuid, asignado_nombre text, mio boolean, puedo_marcar boolean, hecho boolean,
  puedo_editar boolean
)
language sql security definer set search_path = public stable
as $$
  with base as (
    select i.*
    from item_grupo i
    where i.id_grupo = p_grupo
      and (
        i.tipo = 'TAREA'
        or (i.tipo = 'OBJETIVO'
            and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
            and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
            and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and (extract(isodow from p_fecha)::int = any(i.dias)))))
      )
  ),
  filas as (
    -- Ítems con asignados: una fila por cada miembro que "le toca" ese día.
    select b.*, me.id_miembro as fila_miembro
    from base b
    join lateral public.miembros_esperados_item(b.id_item, p_fecha) me(id_miembro) on true
    union all
    -- Ítems sin asignar: una sola fila compartida (miembro null), como hoy.
    select b.*, null::uuid as fila_miembro
    from base b
    where not exists (select 1 from asignacion_item a where a.id_item = b.id_item)
  )
  select
    f.id_item, f.titulo, f.descripcion, f.icono, f.tipo, f.frecuencia, f.dias,
    f.fecha_limite, f.hora_limite, f.fecha_fin, f.prioridad,
    f.fila_miembro as id_miembro_asignado,
    (select coalesce(nullif(trim(p.nombre),''), nullif(trim(m.nombre_visible),''), nullif(split_part(u.email,'@',1),''), 'Miembro')
     from miembro_grupo m left join perfil p on p.id_usuario=m.id_usuario left join auth.users u on u.id=m.id_usuario
     where m.id_miembro = f.fila_miembro) as asignado_nombre,
    (f.fila_miembro is not null and f.fila_miembro in (
       select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as mio,
    (es_admin_grupo(p_grupo, auth.uid()) or f.fila_miembro is null
       or f.fila_miembro in (select id_miembro from miembro_grupo where id_grupo = p_grupo and id_usuario = auth.uid())) as puedo_marcar,
    (case when f.tipo = 'TAREA'
          then exists (select 1 from registro_grupo r where r.id_item = f.id_item and r.hecho and r.id_miembro is not distinct from f.fila_miembro)
          else exists (select 1 from registro_grupo r where r.id_item = f.id_item and r.fecha = p_fecha and r.hecho and r.id_miembro is not distinct from f.fila_miembro)
     end) as hecho,
    (es_admin_grupo(p_grupo, auth.uid()) or f.creado_por = auth.uid()) as puedo_editar
  from filas f
  where es_miembro_grupo(p_grupo, auth.uid())
  order by (f.tipo = 'OBJETIVO') desc, f.fecha_creacion asc, asignado_nombre asc;
$$;
grant execute on function public.esperados_grupo(uuid, date) to authenticated;
