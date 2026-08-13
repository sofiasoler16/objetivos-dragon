-- ============================================================
--  SEED — 4º dragón: HIELO ❄️  (desbloqueable por LOGRO)
--  Idempotente. asset_key='dragon_hielo' → constants/dragons.ts.
--  Tema CLARO helado: fondo celeste muy claro; la app lo detecta como claro
--  (por la luminancia del background) y deriva chips claros (logic/tema.ts).
--  Regla de desbloqueo: SEMANA_PERFECTA. Los dragones de LOGRO NO se compran:
--  `evaluar_logros` REGALA el dragón (usuario_dragon, precio 0) en cuanto se
--  desbloquea el logro "Semana perfecta". credit_cost 0 (informativo).
--  ⚠️ Requiere haber corrido antes funciones-logros.sql (el logro + evaluar_logros).
-- ============================================================
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Hielo', '#2f9fd4', '#5ec5e6', '#a7e3f2',
       '#eef7fb', '#ffffff', '#22c55e', '#e08a2c',
       '#173743', '#5a7a86'
where not exists (select 1 from tema where nombre = 'Hielo');

insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Hielo', 'Un dragón de escarcha: se gana con una semana impecable.', 'dragon_hielo',
       t.id_tema, 0, false, false, true, 4
from tema t
where t.nombre = 'Hielo'
  and not exists (select 1 from dragon where nombre = 'Hielo');

insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value, percentage_required)
select d.id_dragon, 'SEMANA_PERFECTA', null, 80
from dragon d
where d.nombre = 'Hielo'
  and not exists (select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon);
