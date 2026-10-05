-- ============================================================
--  SEED — dragón SAMURÁI ⚔️ (PREMIUM tipo B: 250 monedas, SOLO con Premium)
--  · asset_key = 'dragon_samurai' → constants/dragons.ts (DRAGON_ART).
--  · premium_required = true, credit_cost = 250 → con Premium se compra por 250 🪙.
--  · Tema OSCURO: rojo carmesí + negro con acentos dorados.
--  Idempotente (where not exists).
-- ============================================================

-- Tema samurái: primario carmesí, secundario carmesí profundo, acento dorado,
-- fondo negro con tinte rojo, textos claros.
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Samurái', '#c1121f', '#7a1720', '#d4af37',
       '#1a0d0f', '#26161a', '#22c55e', '#d4af37',
       '#f5e9ea', '#b79ba0'
where not exists (select 1 from tema where nombre = 'Samurái');

-- Dragón Samurái (premium + 250 monedas).
insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Samurái', 'Un dragón guerrero: honor carmesí y oro.', 'dragon_samurai',
       t.id_tema, 250, true, false, true, 13
from tema t
where t.nombre = 'Samurái'
  and not exists (select 1 from dragon where nombre = 'Samurái');

-- Regla FREE (el gating de Premium lo maneja premium_required + comprar_dragon;
-- las 250 monedas las cobra comprar_dragon).
insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Samurái'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
