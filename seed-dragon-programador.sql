-- ============================================================
--  SEED — dragón PROGRAMADOR 👨‍💻 (PREMIUM tipo B: 250 monedas, SOLO con Premium)
--  · asset_key = 'dragon_programador' → constants/dragons.ts (DRAGON_ART).
--  · premium_required = true, credit_cost = 250 → con Premium se compra por 250 🪙.
--  · Tema OSCURO tipo editor de código (fondo negro #0d1117) + acentos naranja neón.
--    El borde naranja neón de las tarjetas lo activa el nombre 'Programador' en logic/tema.ts.
--  Idempotente (where not exists).
-- ============================================================

-- Tema programador: fondo oscuro de editor + primario naranja neón (= borde de tarjetas),
-- secundario azul editor, acento verde terminal, textos claros.
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Programador', '#ff7a18', '#58a6ff', '#3fb950',
       '#0d1117', '#161b22', '#3fb950', '#ff7a18',
       '#e6edf3', '#8b949e'
where not exists (select 1 from tema where nombre = 'Programador');

-- Dragón Programador (premium + 250 monedas).
insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Programador', 'Un dragón que compila objetivos: fondo oscuro y neón.', 'dragon_programador',
       t.id_tema, 250, true, false, true, 12
from tema t
where t.nombre = 'Programador'
  and not exists (select 1 from dragon where nombre = 'Programador');

-- Regla FREE (el gating de Premium lo maneja premium_required + comprar_dragon;
-- las 250 monedas las cobra comprar_dragon).
insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Programador'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
