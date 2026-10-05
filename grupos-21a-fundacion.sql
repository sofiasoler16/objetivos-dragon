-- ============================================================
--  GRUPOS — Paso 21a (Tema 1, Fundación): asignación múltiple + marca por persona
--  Corré este archivo al hacer el build (junto con 21b, 21c, 21d). NO cambia comportamiento todavía:
--  es aditivo (tabla nueva + columna nueva + migración). El marcar y las cuentas siguen igual hasta 21b/21c.
--
--   · asignacion_item        → quién hace cada ítem y en qué días (reemplaza a id_miembro_asignado)
--   · registro_grupo.id_miembro → de quién es cada marca (null = marca compartida, ítem sin asignar)
--   · miembros_esperados_item(item, fecha) → helper: qué miembros "les toca" ese ítem ese día
--  Migración: cada ítem con dueño único → su fila en asignacion_item; cada marca vieja → su dueño.
-- ============================================================

-- ---------- Tabla de asignaciones (varios miembros por ítem, con días opcionales) ----------
create table if not exists asignacion_item (
  id_item        uuid not null references item_grupo(id_item) on delete cascade,
  id_miembro     uuid not null references miembro_grupo(id_miembro) on delete cascade,
  dias           int[],  -- null = todos los días que el ítem "toca"; ISO 1..7 = solo esos días
  fecha_creacion timestamptz not null default now(),
  primary key (id_item, id_miembro)
);
create index if not exists idx_asignacion_item on asignacion_item(id_item);

alter table asignacion_item enable row level security;
drop policy if exists "asignacion_item_ver" on asignacion_item;
create policy "asignacion_item_ver" on asignacion_item for select using (
  exists (select 1 from item_grupo i where i.id_item = asignacion_item.id_item and es_miembro_grupo(i.id_grupo))
);

-- Migración: los ítems que hoy tienen un dueño único → una fila en asignacion_item (sin días = todos).
insert into asignacion_item (id_item, id_miembro, dias)
select id_item, id_miembro_asignado, null
from item_grupo
where id_miembro_asignado is not null
on conflict (id_item, id_miembro) do nothing;

-- ---------- Marca por persona ----------
-- id_miembro = de quién es la marca. null = marca compartida (ítem sin asignar, como hoy).
alter table registro_grupo add column if not exists id_miembro uuid references miembro_grupo(id_miembro) on delete cascade;

-- Migración: las marcas de ítems con dueño único pasan a ser de ese dueño.
update registro_grupo r
set id_miembro = i.id_miembro_asignado
from item_grupo i
where r.id_item = i.id_item
  and i.id_miembro_asignado is not null
  and r.id_miembro is null;

-- ---------- Helper: ¿qué miembros "les toca" un ítem en una fecha? ----------
-- Devuelve el set de id_miembro asignados que están activos ese día (según su `dias`).
-- Si el ítem no tiene filas en asignacion_item = "sin asignar" (no devuelve nada; se maneja aparte).
create or replace function public.miembros_esperados_item(p_item uuid, p_fecha date)
returns setof uuid
language sql stable set search_path = public
as $$
  select a.id_miembro
  from asignacion_item a
  where a.id_item = p_item
    and (a.dias is null or extract(isodow from p_fecha)::int = any(a.dias));
$$;
grant execute on function public.miembros_esperados_item(uuid, date) to authenticated;
