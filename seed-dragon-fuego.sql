-- ============================================================
--  SEED — 2º dragón: FUEGO 🔥  (catálogo, para probar "Mi Dragón")
--  Idempotente (where not exists): se puede re-ejecutar sin duplicar.
--  · asset_key = 'dragon_fuego' → mapea a constants/dragons.ts (DRAGON_ART).
--  · credit_cost = 100 → se compra con monedas (Paso 3).
--  · regla FREE → no pide requisito; solo faltan las monedas.
--  Los colores del tema recién se APLICAN en el Paso 4 (sistema de temas).
-- ============================================================

-- Tema cálido que combina con el dragón de fuego (rojo brasa + naranja + dorado).
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Fuego', '#d9442b', '#f5822b', '#f6b93b',
       '#fdf4ee', '#ffffff', '#22c55e', '#e08a2c',
       '#2c1810', '#8a7368'
where not exists (select 1 from tema where nombre = 'Fuego');

-- Dragón Fuego (comprable con créditos).
insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Fuego', 'Un dragón de brasa, para los que no se apagan.', 'dragon_fuego',
       t.id_tema, 100, false, false, true, 2
from tema t
where t.nombre = 'Fuego'
  and not exists (select 1 from dragon where nombre = 'Fuego');

-- Regla de desbloqueo: FREE (sin requisito extra; solo hace falta tener las monedas).
insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Fuego'
  and not exists (
    select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon
  );
