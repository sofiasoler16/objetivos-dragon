-- ============================================================
--  GRUPOS — Paso 12 (Fase 3): adoptar ítems del grupo a tu Hoy PERSONAL (por referencia)
--  Corré este archivo en el SQL Editor de Supabase (después de 1..11).
--
--  🔒 El ítem SIGUE siendo del grupo (una sola fuente de verdad). "Adoptar" = un vínculo liviano
--  para VERLO en tu Hoy personal. Al cumplirlo suma SOLO al % del grupo (no al personal).
--
--   · adopcion_personal        → vínculo usuario ↔ ítem de grupo (con hora opcional, a futuro calendario)
--   · adoptar_item / quitar_adopcion
--   · mis_adopciones(grupo)     → ids que adopté en ese grupo (para el interruptor en la pantalla del grupo)
--   · mis_items_hoy_grupos(fecha) → mis ítems de grupo adoptados que "tocan" ese día (para el Hoy personal)
-- ============================================================

create table if not exists adopcion_personal (
  id_usuario   uuid not null references perfil(id_usuario) on delete cascade,
  id_item      uuid not null references item_grupo(id_item) on delete cascade,
  hora_inicio  text,   -- opcional (a futuro: agendar en el calendario personal)
  hora_fin     text,
  fecha_creacion timestamptz not null default now(),
  primary key (id_usuario, id_item)
);

alter table adopcion_personal enable row level security;
drop policy if exists "adopcion_propia" on adopcion_personal;
create policy "adopcion_propia" on adopcion_personal
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

-- Adoptar un ítem del grupo a mi Hoy (solo si soy miembro del grupo del ítem).
create or replace function public.adoptar_item(p_item uuid, p_hora_inicio text default null, p_hora_fin text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
        v_grupo uuid;
        v_asignado uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select id_grupo, id_miembro_asignado into v_grupo, v_asignado from item_grupo where id_item = p_item;
  if v_grupo is null then raise exception 'Ese ítem no existe'; end if;
  if not es_miembro_grupo(v_grupo, v_uid) then raise exception 'No sos miembro del grupo'; end if;
  -- Solo se adopta lo propio o lo sin asignar (un admin NO se lleva lo de otro a su Hoy personal).
  if v_asignado is not null
     and v_asignado not in (select id_miembro from miembro_grupo where id_grupo = v_grupo and id_usuario = v_uid) then
    raise exception 'Solo podés agregar a tu Hoy lo que te toca a vos o lo que no tiene dueño';
  end if;
  insert into adopcion_personal (id_usuario, id_item, hora_inicio, hora_fin)
  values (v_uid, p_item, p_hora_inicio, p_hora_fin)
  on conflict (id_usuario, id_item) do update set hora_inicio = excluded.hora_inicio, hora_fin = excluded.hora_fin;
end;
$$;
grant execute on function public.adoptar_item(uuid, text, text) to authenticated;

create or replace function public.quitar_adopcion(p_item uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from adopcion_personal where id_usuario = auth.uid() and id_item = p_item;
$$;
grant execute on function public.quitar_adopcion(uuid) to authenticated;

-- Ids de ítems que adopté en un grupo (para el interruptor "Agregar a mi Hoy").
create or replace function public.mis_adopciones(p_grupo uuid)
returns table (id_item uuid)
language sql security definer set search_path = public stable
as $$
  select a.id_item
  from adopcion_personal a
  join item_grupo i on i.id_item = a.id_item
  where a.id_usuario = auth.uid() and i.id_grupo = p_grupo;
$$;
grant execute on function public.mis_adopciones(uuid) to authenticated;

-- Mis ítems de grupo adoptados que "tocan" un día (para mostrarlos en el Hoy personal, de todos mis grupos).
create or replace function public.mis_items_hoy_grupos(
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (
  id_item uuid, titulo text, icono text, tipo text, grupo_nombre text, hora_inicio text,
  puedo_marcar boolean, hecho boolean
)
language sql security definer set search_path = public stable
as $$
  select i.id_item, i.titulo, i.icono, i.tipo, g.nombre as grupo_nombre, a.hora_inicio,
         (es_admin_grupo(i.id_grupo, auth.uid()) or i.id_miembro_asignado is null
            or i.id_miembro_asignado in (select id_miembro from miembro_grupo where id_grupo = i.id_grupo and id_usuario = auth.uid())) as puedo_marcar,
         (case when i.tipo = 'TAREA'
               then exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.hecho)
               else exists (select 1 from registro_grupo r where r.id_item = i.id_item and r.fecha = p_fecha and r.hecho)
          end) as hecho
  from adopcion_personal a
  join item_grupo i on i.id_item = a.id_item
  join grupo g on g.id_grupo = i.id_grupo
  where a.id_usuario = auth.uid()
    and (
      i.tipo = 'TAREA'
      or (i.tipo = 'OBJETIVO'
          and (i.fecha_inicio is null or i.fecha_inicio <= p_fecha)
          and (i.fecha_fin is null or i.fecha_fin >= p_fecha)
          and (i.frecuencia = 'DIARIA' or (i.frecuencia = 'DIAS' and (extract(isodow from p_fecha)::int = any(i.dias)))))
    )
  order by i.tipo, i.titulo;
$$;
grant execute on function public.mis_items_hoy_grupos(date) to authenticated;

-- Limpieza: borrar adopciones de ítems asignados a OTRO miembro (regla nueva: solo lo propio o sin asignar).
delete from adopcion_personal a
using item_grupo i
where a.id_item = i.id_item
  and i.id_miembro_asignado is not null
  and i.id_miembro_asignado not in (
    select m.id_miembro from miembro_grupo m
    where m.id_grupo = i.id_grupo and m.id_usuario = a.id_usuario
  );
