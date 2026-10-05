-- ============================================================
--  GRUPOS — Paso 19: nuevos valores de puntos por prioridad
--  Corré este archivo en el SQL Editor de Supabase (después del 17/18).
--
--  Cambio: tarea BAJA 5 / MEDIA 10 / ALTA 15 (antes 10/20/30). Objetivo sigue en 10.
--  Además recalcula los puntos YA otorgados por cumplimientos, para que los saldos queden coherentes.
-- ============================================================

create or replace function public.puntos_de_item(p_tipo text, p_prioridad text)
returns int language sql immutable as $$
  select case when p_tipo = 'OBJETIVO' then 10
              else case p_prioridad when 'ALTA' then 15 when 'MEDIA' then 10 else 5 end
         end;
$$;

-- Recalcular los movimientos de cumplimiento existentes con los nuevos valores.
update punto_grupo p
set puntos = puntos_de_item(i.tipo, i.prioridad)
from item_grupo i
where p.motivo = 'cumplimiento'
  and p.clave is not null
  and i.id_item = (split_part(p.clave, ':', 2))::uuid;
