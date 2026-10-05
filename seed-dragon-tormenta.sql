-- ============================================================
--  SEED — dragón TORMENTA ⛈️  (se desbloquea por NIVEL 10, gratis al llegar)
--  Idempotente. asset_key='dragon_tormenta' → constants/dragons.ts.
--  Tema OSCURO (cielo de tormenta): la app lo detecta como oscuro por la
--  luminancia del background y deriva chips oscuros + textos claros (logic/tema.ts).
--  Regla: NIVEL con target 10. `comprar_dragon` ya valida NIVEL → cuando llegás al
--  nivel 10 aparece en "Disponibles" y lo reclamás por 0 monedas (credit_cost 0).
-- ============================================================
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Tormenta', '#7c6cf0', '#5b6b9e', '#ffd84d',
       '#15131f', '#221f30', '#22c55e', '#e08a2c',
       '#ece9f7', '#a29ec2'
where not exists (select 1 from tema where nombre = 'Tormenta');

insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Tormenta', 'Nacido del rayo: se desbloquea al llegar al nivel 10.', 'dragon_tormenta',
       t.id_tema, 0, false, false, true, 6
from tema t
where t.nombre = 'Tormenta'
  and not exists (select 1 from dragon where nombre = 'Tormenta');

insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value, percentage_required)
select d.id_dragon, 'NIVEL', 10, null
from dragon d
where d.nombre = 'Tormenta'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
