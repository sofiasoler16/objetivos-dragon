-- ============================================================
--  SEED — dragón MAGO 🧙  (comprable con monedas)
--  Idempotente. asset_key='dragon_mago' → constants/dragons.ts.
--  · credit_cost = 150 → se compra con monedas. Regla FREE (solo faltan las monedas).
--  · Tema místico: violeta arcano + dorado. Arte ya normalizado (549x703, poses parejas).
-- ============================================================

insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Mago', '#3b57d4', '#6c80f0', '#f4c542',
       '#b394e2', '#bae5ec', '#22c55e', '#e08a2c',
       '#2a1f45', '#6b5f85'
where not exists (select 1 from tema where nombre = 'Mago');

insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Mago', 'Un dragón hechicero: sabiduría y un poco de magia.', 'dragon_mago',
       t.id_tema, 150, false, false, true, 10
from tema t
where t.nombre = 'Mago'
  and not exists (select 1 from dragon where nombre = 'Mago');

insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Mago'
  and not exists (
    select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon
  );
