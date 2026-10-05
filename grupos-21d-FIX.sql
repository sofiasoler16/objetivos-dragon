-- ============================================================
--  GRUPOS — Paso 21d (Tema 1): adopción al Hoy personal por persona + aviso de asignación
--  Corré este archivo al hacer el build (después de 21a, 21b, 21c).
--
--   · mis_items_hoy_grupos → muestra MI instancia (mi casilla) del ítem adoptado, con MI "hecho".
--   · Realtime en asignacion_item → para que el aviso "te asignaron" funcione con la asignación nueva
--     (la app nueva se suscribe a esta tabla; ver Fase 2).
-- ============================================================

-- ---------- Mis ítems de grupo adoptados que "tocan" un día — MI instancia ----------
create or replace function public.mis_items_hoy_grupos(
  p_fecha date default (now() at time zone 'America/Argentina/Buenos_Aires')::date
)
returns table (
  id_item uuid, titulo text, icono text, tipo text, grupo_nombre text, hora_inicio text,
  puedo_marcar boolean, hecho boolean
)
language sql security definer set search_path = public stable
as $$
  select
    i.id_item, i.titulo, i.icono, i.tipo, g.nombre as grupo_nombre, a.hora_inicio,
    true as puedo_marcar,  -- en mi Hoy siempre marco MI instancia
    (case when i.tipo = 'TAREA'
          then exists (select 1 from registro_grupo r
                        where r.id_item = i.id_item and r.hecho
                          and r.id_miembro is not distinct from
                              (case when exists (select 1 from asignacion_item x where x.id_item = i.id_item)
                                    then (select m.id_miembro from miembro_grupo m where m.id_grupo = i.id_grupo and m.id_usuario = auth.uid())
                                    else null end))
          else exists (select 1 from registro_grupo r
                        where r.id_item = i.id_item and r.fecha = p_fecha and r.hecho
                          and r.id_miembro is not distinct from
                              (case when exists (select 1 from asignacion_item x where x.id_item = i.id_item)
                                    then (select m.id_miembro from miembro_grupo m where m.id_grupo = i.id_grupo and m.id_usuario = auth.uid())
                                    else null end))
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
    -- Solo si me toca ese día (estoy asignado y activo hoy) o el ítem es sin asignar.
    and (
      not exists (select 1 from asignacion_item x where x.id_item = i.id_item)
      or exists (select 1 from asignacion_item x
                 where x.id_item = i.id_item
                   and x.id_miembro = (select m.id_miembro from miembro_grupo m where m.id_grupo = i.id_grupo and m.id_usuario = auth.uid())
                   and (x.dias is null or extract(isodow from p_fecha)::int = any(x.dias)))
    )
  order by i.tipo, i.titulo;
$$;
grant execute on function public.mis_items_hoy_grupos(date) to authenticated;

-- ---------- Realtime en asignacion_item (para el aviso "te asignaron" de la app nueva) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'asignacion_item'
  ) then
    execute 'alter publication supabase_realtime add table asignacion_item';
  end if;
end $$;
alter table asignacion_item replica identity full;
