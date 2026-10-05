-- ============================================================
--  SEED — dragón GIMNASIO 💪  (comprable con monedas)
--  Idempotente. asset_key='dragon_gimnasio' → constants/dragons.ts.
--  · credit_cost = 150 → se compra con monedas. Regla FREE (solo faltan las monedas).
--  · Tema atlético: GRIS de acero + VERDE (primario = borde de tarjeta) + detalles
--    oscuros/negros. Arte ya normalizado (583x703, poses parejas).
-- ============================================================

insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Gimnasio', '#16a34a', '#2b2f36', '#16a34a',
       '#eceef1', '#ffffff', '#22c55e', '#e08a2c',
       '#16181d', '#5c6470'
where not exists (select 1 from tema where nombre = 'Gimnasio');

insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Gimnasio', 'Un dragón fitness: energía para no aflojar nunca.', 'dragon_gimnasio',
       t.id_tema, 150, false, false, true, 11
from tema t
where t.nombre = 'Gimnasio'
  and not exists (select 1 from dragon where nombre = 'Gimnasio');

insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Gimnasio'
  and not exists (
    select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon
  );
