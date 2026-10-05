-- ============================================================
--  SEED — dragón ARCOÍRIS 🌈 (PREMIUM tipo B: 250 monedas, SOLO con Premium)
--  · asset_key = 'dragon_arcoiris' → constants/dragons.ts (DRAGON_ART).
--  · premium_required = true, credit_cost = 250 → con Premium se compra por 250 🪙.
--  · Tema base CLARO y festivo: el efecto arcoíris (bordes de tarjeta multicolor +
--    grilla anual multicolor) lo activa el nombre 'Arcoíris' en logic/tema.ts.
--  Idempotente (where not exists).
-- ============================================================

-- Tema arcoíris: base clara para que resalten los colores; primario magenta festivo,
-- secundario azul, acento amarillo (los bordes de las tarjetas rotan por todo el arcoíris).
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Arcoíris', '#d6336c', '#1e88e5', '#fdd835',
       '#fff8fc', '#ffffff', '#43a047', '#fb8c00',
       '#2a1f33', '#7a6b78'
where not exists (select 1 from tema where nombre = 'Arcoíris');

-- Dragón Arcoíris (premium + 250 monedas).
insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Arcoíris', 'Un dragón de todos los colores: alegría pura.', 'dragon_arcoiris',
       t.id_tema, 250, true, false, true, 11
from tema t
where t.nombre = 'Arcoíris'
  and not exists (select 1 from dragon where nombre = 'Arcoíris');

-- Regla FREE (el gating de Premium lo maneja premium_required + comprar_dragon;
-- las 250 monedas las cobra comprar_dragon).
insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Arcoíris'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
