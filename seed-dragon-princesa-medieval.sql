-- ============================================================
--  SEED — dragón PRINCESA MEDIEVAL 👑 (PREMIUM tipo B: 100 monedas, SOLO con Premium)
--  · asset_key = 'dragon_princesa_medieval' → constants/dragons.ts (DRAGON_ART).
--  · premium_required = true, credit_cost = 100 → con Premium se compra por 100 🪙;
--    sin Premium queda bloqueado (paywall) y NO se puede comprar ni con monedas.
--  Idempotente (where not exists).
-- ============================================================

-- Tema princesa: verde esmeralda + dorado real.
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Princesa Medieval', '#2fae63', '#7cc98e', '#e0b53c',
       '#f0faf1', '#ffffff', '#22c55e', '#d98b2b',
       '#1f3a28', '#6b8a72'
where not exists (select 1 from tema where nombre = 'Princesa Medieval');

-- Dragón Princesa Medieval (premium + 100 monedas).
insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Princesa Medieval', 'Realeza dragón: elegante y decidida.', 'dragon_princesa_medieval',
       t.id_tema, 100, true, false, true, 6
from tema t
where t.nombre = 'Princesa Medieval'
  and not exists (select 1 from dragon where nombre = 'Princesa Medieval');

-- Regla FREE (el gating de Premium lo maneja premium_required + comprar_dragon;
-- el costo de 100 monedas lo cobra comprar_dragon).
insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Princesa Medieval'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
