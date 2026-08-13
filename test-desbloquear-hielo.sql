-- ============================================================
--  TEST (temporal) — Desbloquear "Semana perfecta" y RECIBIR el dragón de Hielo
--  para probarlo HOY, sin esperar una semana real.
--  Simula exactamente lo que hace evaluar_logros al cumplir el logro:
--    · marca el logro como desbloqueado (usuario_logro)
--    · regala el dragón de hielo (usuario_dragon, precio 0)
--    · otorga la recompensa del logro (+50 XP / +30 🪙) y recalcula el caché
--  Idempotente. Si tu mail es otro, cambialo en las 5 apariciones.
--  ⚠️ Antes: corré funciones-logros.sql (actualizado) y seed-dragon-hielo.sql.
--  Después de correr: en la app, entrá a "Mi Dragón" (se refresca al abrir) →
--  el Hielo aparece en "Mi colección" → Equipar → se pinta todo celeste.
-- ============================================================

-- 1) Logro desbloqueado
insert into usuario_logro (id_usuario, id_logro)
select p.id_usuario, l.id_logro
from perfil p
cross join logro l
where p.id_usuario = (select id from auth.users where email = 'sofiasoler16044@gmail.com')
  and l.nombre = 'Semana perfecta'
on conflict do nothing;

-- 2) Dragón de hielo regalado
insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
select p.id_usuario, d.id_dragon, 0
from perfil p
cross join dragon d
where p.id_usuario = (select id from auth.users where email = 'sofiasoler16044@gmail.com')
  and d.nombre = 'Hielo'
on conflict (id_usuario, id_dragon) do nothing;

-- 3) Recompensa del logro (XP + monedas) + recalcular caché del perfil
insert into movimiento_xp (id_usuario, cantidad, motivo, clave_idempotencia)
select p.id_usuario, l.xp_reward, 'LOGRO', 'xp:logro:' || l.id_logro::text
from perfil p
cross join logro l
where p.id_usuario = (select id from auth.users where email = 'sofiasoler16044@gmail.com')
  and l.nombre = 'Semana perfecta' and l.xp_reward > 0
on conflict (clave_idempotencia) do nothing;

insert into movimiento_credito (id_usuario, monto, tipo, clave_idempotencia)
select p.id_usuario, l.credit_reward, 'LOGRO', 'cr:logro:' || l.id_logro::text
from perfil p
cross join logro l
where p.id_usuario = (select id from auth.users where email = 'sofiasoler16044@gmail.com')
  and l.nombre = 'Semana perfecta' and l.credit_reward > 0
on conflict (clave_idempotencia) do nothing;

update perfil set
  xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = perfil.id_usuario), 0),
  creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = perfil.id_usuario), 0)
where id_usuario = (select id from auth.users where email = 'sofiasoler16044@gmail.com');
update perfil set nivel = greatest(1, floor(xp_total / 100.0)::int + 1)
where id_usuario = (select id from auth.users where email = 'sofiasoler16044@gmail.com');


-- ============================================================
--  ¿Querés volver atrás para después probar el flujo REAL (con celebración)?
--  Descomentá y corré este bloque: borra el logro, el dragón y su recompensa.
-- ============================================================
-- with yo as (select id from auth.users where email = 'sofiasoler16044@gmail.com'),
--      l  as (select id_logro from logro where nombre = 'Semana perfecta')
-- delete from usuario_dragon
--   where id_usuario = (select id from yo)
--     and id_dragon = (select id_dragon from dragon where nombre = 'Hielo');
-- delete from movimiento_xp
--   where id_usuario = (select id from yo)
--     and clave_idempotencia = 'xp:logro:' || (select id_logro from l)::text;
-- delete from movimiento_credito
--   where id_usuario = (select id from yo)
--     and clave_idempotencia = 'cr:logro:' || (select id_logro from l)::text;
-- delete from usuario_logro
--   where id_usuario = (select id from yo) and id_logro = (select id_logro from l);
-- update perfil set
--   xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = perfil.id_usuario), 0),
--   creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = perfil.id_usuario), 0)
-- where id_usuario = (select id from yo);
-- update perfil set nivel = greatest(1, floor(xp_total / 100.0)::int + 1)
-- where id_usuario = (select id from yo);
