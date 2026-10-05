-- ⚠️ RESET DE CUENTA (destructivo). Borra TODOS los datos de uso de UN usuario y lo deja
-- como recién registrado: 4 categorías por defecto, dragón inicial equipado, perfil en cero,
-- y 350 monedas de arranque (para desbloquear Fuego 100 + Nocturno 250). NO borra la cuenta.
--
-- CÓMO USAR: reemplazá 'TU-EMAIL-AQUI' por el email con el que entrás a la app, y corré todo
-- en el SQL Editor de Supabase.

do $$
declare
  u uuid;
begin
  select id into u from auth.users where lower(email) = lower('sofi@sofiasoler.com.ar');
  if u is null then
    raise exception 'No encontré un usuario con ese email. Revisá el email.';
  end if;

  -- 1) Borrar datos de uso
  delete from movimiento_credito  where id_usuario = u;
  delete from movimiento_xp       where id_usuario = u;
  delete from usuario_logro       where id_usuario = u;
  delete from usuario_dragon      where id_usuario = u;
  delete from preferencia_usuario where id_usuario = u;
  delete from suscripcion         where id_usuario = u;
  delete from objetivo            where id_usuario = u;  -- cascada: objetivo_dia, registro_objetivo
  delete from tarea               where id_usuario = u;
  delete from categoria           where id_usuario = u;

  -- 2) Re-sembrar como recién registrado (igual que el trigger de alta)
  insert into categoria (id_usuario, nombre, icono, color) values
    (u, 'Fitness',     '🏋️', '#8B5CF6'),
    (u, 'Universidad', '🎓', '#22C55E'),
    (u, 'Personal',    '🙂', '#6366F1'),
    (u, 'Salud',       '❤️', '#EF4444');

  insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
  select u, d.id_dragon, 0
  from dragon d
  where d.es_inicial and d.activo
  order by d.orden nulls last
  limit 1;

  insert into preferencia_usuario (id_usuario, id_dragon_seleccionado, id_tema_seleccionado)
  select u, d.id_dragon, d.id_tema
  from dragon d
  where d.es_inicial and d.activo
  order by d.orden nulls last
  limit 1
  on conflict (id_usuario) do update
    set id_dragon_seleccionado = excluded.id_dragon_seleccionado,
        id_tema_seleccionado   = excluded.id_tema_seleccionado;

  -- 3) Monedas de arranque (350) como movimiento, para respetar el log como fuente de verdad
  insert into movimiento_credito (id_usuario, monto, tipo, descripcion, clave_idempotencia)
  values (u, 350, 'WELCOME', 'Monedas de bienvenida', 'welcome:' || u::text);

  -- 4) Recalcular el caché del perfil desde los logs
  update perfil set
    xp_total = coalesce((select sum(cantidad) from movimiento_xp     where id_usuario = u), 0),
    creditos = coalesce((select sum(monto)    from movimiento_credito where id_usuario = u), 0),
    nivel    = 1
  where id_usuario = u;

  raise notice 'Cuenta reseteada OK. Monedas = %', (select creditos from perfil where id_usuario = u);
end $$;
