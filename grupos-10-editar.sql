-- ============================================================
--  GRUPOS — Paso 10 (Fase 2): editar / borrar ítems del grupo
--  Corré este archivo en el SQL Editor de Supabase (después de 1..9, y volvé a correr grupos-8
--  porque se le agregó `puedo_editar` a esperados_grupo y semanales_grupo).
--
--   · obtener_item_grupo(item) → todos los datos del ítem (para precargar el formulario de editar)
--   · editar_item_grupo(...)   → edita el ítem. Permiso: ADMIN del grupo O quien lo creó.
--   · borrar_item_grupo(item)  → lo borra. Mismo permiso.
-- ============================================================

-- Devuelve el ítem completo (solo si sos miembro del grupo). Para precargar el form de editar.
create or replace function public.obtener_item_grupo(p_item uuid)
returns table (
  id_item uuid, titulo text, descripcion text, icono text, tipo text, frecuencia text, dias int[],
  veces_semana int, fecha_inicio date, fecha_fin date, fecha_limite date, hora_limite text,
  prioridad text, id_miembro_asignado uuid
)
language sql security definer set search_path = public stable
as $$
  select i.id_item, i.titulo, i.descripcion, i.icono, i.tipo, i.frecuencia, i.dias,
         i.veces_semana, i.fecha_inicio, i.fecha_fin, i.fecha_limite, i.hora_limite,
         i.prioridad, i.id_miembro_asignado
  from item_grupo i
  where i.id_item = p_item and es_miembro_grupo(i.id_grupo, auth.uid());
$$;
grant execute on function public.obtener_item_grupo(uuid) to authenticated;

-- ¿Puede el usuario actual editar/borrar este ítem? (admin del grupo o el creador)
create or replace function public.puede_editar_item(p_item uuid, p_uid uuid default auth.uid())
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from item_grupo i
    where i.id_item = p_item and (es_admin_grupo(i.id_grupo, p_uid) or i.creado_por = p_uid)
  );
$$;
grant execute on function public.puede_editar_item(uuid, uuid) to authenticated;

-- Editar el ítem. Permiso: admin del grupo o quien lo creó.
create or replace function public.editar_item_grupo(
  p_item         uuid,
  p_titulo       text,
  p_tipo         text,
  p_frecuencia   text default null,
  p_dias         int[] default null,
  p_veces_semana int default null,
  p_fecha_inicio date default null,
  p_fecha_fin    date default null,
  p_fecha_limite date default null,
  p_hora_limite  text default null,
  p_prioridad    text default null,
  p_descripcion  text default null,
  p_asignado     uuid default null,
  p_icono        text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
        v_es_obj boolean := (p_tipo = 'OBJETIVO');
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not puede_editar_item(p_item, v_uid) then raise exception 'No podés editar este ítem'; end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Falta el título'; end if;

  select id_grupo into v_grupo from item_grupo where id_item = p_item;
  if p_asignado is not null and not exists (
    select 1 from miembro_grupo m where m.id_miembro = p_asignado and m.id_grupo = v_grupo
  ) then
    raise exception 'La persona asignada no es del grupo';
  end if;

  update item_grupo set
    titulo = trim(p_titulo),
    descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
    tipo = case when v_es_obj then 'OBJETIVO' else 'TAREA' end,
    frecuencia = case when v_es_obj then p_frecuencia else null end,
    dias = case when v_es_obj and p_frecuencia = 'DIAS' then p_dias else null end,
    veces_semana = case when v_es_obj and p_frecuencia = 'SEMANAL' then greatest(1, coalesce(p_veces_semana, 1)) else null end,
    fecha_inicio = case when v_es_obj then p_fecha_inicio else null end,
    fecha_fin = case when v_es_obj then p_fecha_fin else null end,
    fecha_limite = case when not v_es_obj then p_fecha_limite else null end,
    hora_limite = case when not v_es_obj then p_hora_limite else null end,
    prioridad = case when not v_es_obj then coalesce(p_prioridad, 'MEDIA') else null end,
    id_miembro_asignado = p_asignado,
    icono = p_icono
  where id_item = p_item;
end;
$$;
grant execute on function public.editar_item_grupo(uuid, text, text, text, int[], int, date, date, date, text, text, text, uuid, text) to authenticated;

-- Borrar el ítem (y sus cumplimientos por cascada). Permiso: admin o creador.
create or replace function public.borrar_item_grupo(p_item uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not puede_editar_item(p_item, v_uid) then raise exception 'No podés borrar este ítem'; end if;
  delete from item_grupo where id_item = p_item;
end;
$$;
grant execute on function public.borrar_item_grupo(uuid) to authenticated;
