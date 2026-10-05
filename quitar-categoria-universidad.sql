-- ============================================================
--  Sacar "Universidad" de las categorías por defecto de usuarios nuevos.
--  Corré este archivo en el SQL Editor de Supabase.
--
--   1. Redefine handle_new_user (alta de usuario) SIN la categoría "Universidad".
--      (Idéntico al actual salvo esa línea: sigue creando perfil, Fitness/Personal/Salud,
--       y el dragón inicial + tema.)
--   2. Limpieza: borra la categoría "Universidad" de los usuarios que ya la tienen PERO
--      no la usaron (sin objetivos ni tareas). Las que estén en uso NO se tocan.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_id_dragon uuid;
  v_id_tema   uuid;
begin
  insert into perfil (id_usuario, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''));

  insert into categoria (id_usuario, nombre, icono, color) values
    (new.id, 'Fitness',  '🏋️', '#8B5CF6'),
    (new.id, 'Personal', '🙂', '#6366F1'),
    (new.id, 'Salud',    '❤️', '#EF4444');

  -- Dragón inicial (regalo) + su tema, equipados por defecto.
  select d.id_dragon, d.id_tema
    into v_id_dragon, v_id_tema
  from dragon d
  where d.es_inicial and d.activo
  order by d.orden nulls last
  limit 1;

  if v_id_dragon is not null then
    insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
    values (new.id, v_id_dragon, 0)
    on conflict do nothing;

    insert into preferencia_usuario (id_usuario, id_dragon_seleccionado, id_tema_seleccionado)
    values (new.id, v_id_dragon, v_id_tema)
    on conflict (id_usuario) do nothing;
  end if;

  return new;
end;
$$;

-- Limpieza: borrar "Universidad" solo si NO tiene objetivos ni tareas asociados.
delete from categoria c
where c.nombre = 'Universidad'
  and not exists (select 1 from objetivo o where o.id_categoria = c.id_categoria)
  and not exists (select 1 from tarea    t where t.id_categoria = c.id_categoria);
