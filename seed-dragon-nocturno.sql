-- ============================================================
--  SEED — 3er dragón: NOCTURNO 🌙  (tema OSCURO real)
--  Idempotente. asset_key='dragon_nocturno' → constants/dragons.ts.
--  Tema oscuro: fondo azul noche; la app detecta que es oscuro (por la luminancia
--  del background) y deriva chips oscuros + textos claros (logic/tema.ts).
--  credit_cost 250, regla FREE (comprable con monedas).
-- ============================================================
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Nocturno', '#6d78e0', '#7aa2ff', '#f2c14e',
       '#14162b', '#232544', '#22c55e', '#f2c14e',
       '#e8ebff', '#a3a8cf'
where not exists (select 1 from tema where nombre = 'Nocturno');

insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Nocturno', 'Un dragón de medianoche, hecho de lunas y constelaciones.', 'dragon_nocturno',
       t.id_tema, 250, false, false, true, 3
from tema t
where t.nombre = 'Nocturno'
  and not exists (select 1 from dragon where nombre = 'Nocturno');

insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Nocturno'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
