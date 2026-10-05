-- ============================================================
--  SEED — dragón MEDIEVAL 🛡️ (PREMIUM tipo A: se obtiene solo con Premium)
--  · asset_key = 'dragon_medieval' → constants/dragons.ts (DRAGON_ART).
--  · premium_required = true, credit_cost = 0 → con Premium se obtiene gratis;
--    sin Premium queda bloqueado (paywall). NO se compra con monedas.
--  Idempotente (where not exists).
-- ============================================================

-- Tema medieval: verde bosque + dorado (escudo/flor de lis).
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Medieval', '#3f8f4a', '#6faa5f', '#c9a227',
       '#f1f6ec', '#ffffff', '#22c55e', '#d98b2b',
       '#22331f', '#6d7d63'
where not exists (select 1 from tema where nombre = 'Medieval');

-- Dragón Medieval (premium, gratis con la suscripción).
insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Caballero Medieval', 'Un dragón caballero, guardián de tus metas.', 'dragon_medieval',
       t.id_tema, 0, true, false, true, 5
from tema t
where t.nombre = 'Medieval'
  and not exists (select 1 from dragon where nombre = 'Caballero Medieval');

-- Regla FREE (el gating de Premium lo maneja premium_required + comprar_dragon).
insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Caballero Medieval'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
