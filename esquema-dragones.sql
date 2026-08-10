-- ============================================================
--  MIGRACIÓN — Sistema de dragones, temas, XP, créditos, logros
--  ADITIVA: no modifica las tablas del esquema base, solo agrega.
--  Modelo: TIENDA con créditos (NO desbloqueo automático).
--    · XP  = progreso acumulado, NUNCA se gasta.
--    · Créditos = moneda interna, se gana y se gasta al comprar.
--    · Logros / nivel / Premium = requisitos para poder COMPRAR.
--    · Comprar cuesta créditos -> usuario_dragon = "adquirido".
--  Nombres en español para mantener consistencia con el esquema base.
--    tema=THEME · dragon=DRAGON · dragon_regla=UNLOCK_RULE
--    usuario_dragon=USER_DRAGON · movimiento_xp=XP_TRANSACTION
--    movimiento_credito=CREDIT_TRANSACTION · logro=ACHIEVEMENT
--    usuario_logro=USER_ACHIEVEMENT · preferencia_usuario=USER_PREFERENCE
--    suscripcion=SUBSCRIPTION
--
--  IDEMPOTENTE: se puede correr varias veces sin romper (if not exists,
--  drop policy if exists, seeds con guarda). Útil mientras se itera.
-- ============================================================


-- ============================================================
--  0. Cachés en perfil (fuente de verdad = los logs de movimientos)
-- ============================================================
alter table perfil add column if not exists xp_total  integer not null default 0;
alter table perfil add column if not exists creditos  integer not null default 0;
alter table perfil add column if not exists nivel     integer not null default 1;


-- ============================================================
--  1. CATÁLOGO (global, no por usuario): TEMA
-- ============================================================
create table if not exists tema (
  id_tema          uuid primary key default gen_random_uuid(),
  nombre           text not null,
  primary_color    text not null,
  secondary_color  text not null,
  accent_color     text not null,
  background_color text not null,
  surface_color    text not null,
  success_color    text not null,
  warning_color    text not null,
  text_primary     text not null,
  text_secondary   text not null
);


-- ============================================================
--  2. CATÁLOGO: DRAGON
-- ============================================================
create table if not exists dragon (
  id_dragon        uuid primary key default gen_random_uuid(),
  nombre           text not null,
  descripcion      text,
  asset_key        text not null,               -- clave del recurso gráfico
  id_tema          uuid references tema(id_tema),
  credit_cost      integer not null default 0,  -- precio en créditos
  premium_required boolean not null default false,
  es_inicial       boolean not null default false, -- se regala al registrarse
  activo           boolean not null default true,
  orden            integer
);


-- ============================================================
--  3. CATÁLOGO: DRAGON_REGLA_DESBLOQUEO
--  Requisitos para PODER COMPRAR el dragón (no lo entrega solo).
--  rule_type (texto, ampliable sin migración):
--    FREE · XP · NIVEL · TOTAL_OBJETIVOS · TOTAL_TAREAS ·
--    SEMANA_PERFECTA · SEMANAS_SOBRE_PORCENTAJE ·
--    SEMANAS_CONSECUTIVAS_SOBRE_PORCENTAJE · DIAS_ACTIVOS
--  (para "3 semanas consecutivas ≥80%": target_value=3, percentage_required=80)
-- ============================================================
create table if not exists dragon_regla_desbloqueo (
  id_regla            uuid primary key default gen_random_uuid(),
  id_dragon           uuid not null references dragon(id_dragon) on delete cascade,
  rule_type           text not null,
  target_value        numeric,
  percentage_required numeric
);
create index if not exists idx_regla_dragon on dragon_regla_desbloqueo(id_dragon);


-- ============================================================
--  4. CATÁLOGO: LOGRO
-- ============================================================
create table if not exists logro (
  id_logro            uuid primary key default gen_random_uuid(),
  nombre              text not null,
  descripcion         text,
  rule_type           text not null,
  target_value        numeric,
  percentage_required numeric,
  xp_reward           integer not null default 0,
  credit_reward       integer not null default 0,
  activo              boolean not null default true
);


-- ============================================================
--  5. ESTADO DEL USUARIO
-- ============================================================

-- 5.1 Dragones adquiridos (comprados)
create table if not exists usuario_dragon (
  id_usuario         uuid not null references perfil(id_usuario) on delete cascade,
  id_dragon          uuid not null references dragon(id_dragon) on delete cascade,
  purchased_at       timestamptz not null default now(),
  credit_price_paid  integer,                    -- precio pagado en el momento
  primary key (id_usuario, id_dragon)
);

-- 5.2 Logros conseguidos
create table if not exists usuario_logro (
  id_usuario   uuid not null references perfil(id_usuario) on delete cascade,
  id_logro     uuid not null references logro(id_logro) on delete cascade,
  unlocked_at  timestamptz not null default now(),
  primary key (id_usuario, id_logro)
);

-- 5.3 Preferencias (dragón/tema equipados). Separados a propósito:
--     por defecto se mueven juntos, pero a futuro Premium podría permitir
--     "dragón Medieval + tema Original".
create table if not exists preferencia_usuario (
  id_usuario              uuid primary key references perfil(id_usuario) on delete cascade,
  id_dragon_seleccionado  uuid references dragon(id_dragon),
  id_tema_seleccionado    uuid references tema(id_tema)
);

-- 5.4 Suscripción (Premium). Escrita por el servidor (webhook de pago / Edge Function).
--     plan: FREE · PREMIUM_MONTHLY · PREMIUM_YEARLY · LIFETIME
--     status: ACTIVE · EXPIRED · CANCELED   ·   platform: IOS · ANDROID · WEB
create table if not exists suscripcion (
  id_suscripcion   uuid primary key default gen_random_uuid(),
  id_usuario       uuid not null references perfil(id_usuario) on delete cascade,
  plan             text not null default 'FREE',
  status           text not null default 'ACTIVE',
  start_date       timestamptz,
  expiration_date  timestamptz,
  platform         text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_suscripcion_usuario on suscripcion(id_usuario);


-- ============================================================
--  6. LOGS DE MOVIMIENTOS (fuente de verdad de XP y créditos)
--  clave_idempotencia: evita otorgar dos veces el mismo evento.
--    ej: 'obj:{id_objetivo}:{fecha}'  ·  'tarea:{id_tarea}'
--    La función de otorgamiento inserta con ON CONFLICT DO NOTHING.
-- ============================================================

-- 6.1 XP (cantidad siempre > 0: el XP no se gasta)
create table if not exists movimiento_xp (
  id                 uuid primary key default gen_random_uuid(),
  id_usuario         uuid not null references perfil(id_usuario) on delete cascade,
  cantidad           integer not null check (cantidad > 0),
  motivo             text not null,              -- GOAL_COMPLETED, TASK_COMPLETED, PERFECT_DAY, ...
  id_objetivo        uuid references objetivo(id_objetivo) on delete set null,
  id_tarea           uuid references tarea(id_tarea) on delete set null,
  clave_idempotencia text unique,
  fecha_creacion     timestamptz not null default now()
);
create index if not exists idx_mov_xp_usuario on movimiento_xp(id_usuario);

-- 6.2 Créditos (monto + al ganar, - al comprar)
create table if not exists movimiento_credito (
  id                 uuid primary key default gen_random_uuid(),
  id_usuario         uuid not null references perfil(id_usuario) on delete cascade,
  monto              integer not null,           -- +gana / -gasta
  tipo               text not null,              -- GOAL_COMPLETED, ACHIEVEMENT, DRAGON_PURCHASE, ...
  descripcion        text,
  id_objetivo        uuid references objetivo(id_objetivo) on delete set null,
  id_tarea           uuid references tarea(id_tarea) on delete set null,
  id_dragon          uuid references dragon(id_dragon) on delete set null,
  clave_idempotencia text unique,
  created_at         timestamptz not null default now()
);
create index if not exists idx_mov_credito_usuario on movimiento_credito(id_usuario);


-- ============================================================
--  7. ROW LEVEL SECURITY
--  Catálogo -> lectura para cualquier usuario logueado, sin escritura.
--  Estado del usuario -> cada uno ve lo suyo.
--  Movimientos / compras / logros / suscripción -> SOLO lectura del cliente;
--  las ESCRITURAS van por funciones RPC SECURITY DEFINER (ver sección 8),
--  para que nadie se auto-regale XP/créditos con la anon key.
-- ============================================================
alter table tema                    enable row level security;
alter table dragon                  enable row level security;
alter table dragon_regla_desbloqueo enable row level security;
alter table logro                   enable row level security;
alter table usuario_dragon          enable row level security;
alter table usuario_logro           enable row level security;
alter table preferencia_usuario     enable row level security;
alter table suscripcion             enable row level security;
alter table movimiento_xp           enable row level security;
alter table movimiento_credito      enable row level security;

-- Catálogo: lectura para todos los autenticados
drop policy if exists "tema_lectura"   on tema;
drop policy if exists "dragon_lectura" on dragon;
drop policy if exists "regla_lectura"  on dragon_regla_desbloqueo;
drop policy if exists "logro_lectura"  on logro;
create policy "tema_lectura"   on tema                    for select to authenticated using (true);
create policy "dragon_lectura" on dragon                  for select to authenticated using (true);
create policy "regla_lectura"  on dragon_regla_desbloqueo for select to authenticated using (true);
create policy "logro_lectura"  on logro                   for select to authenticated using (true);

-- Estado del usuario: SELECT de lo propio
drop policy if exists "usuario_dragon_sel" on usuario_dragon;
drop policy if exists "usuario_logro_sel"  on usuario_logro;
drop policy if exists "mov_xp_sel"         on movimiento_xp;
drop policy if exists "mov_credito_sel"    on movimiento_credito;
drop policy if exists "suscripcion_sel"    on suscripcion;
create policy "usuario_dragon_sel"  on usuario_dragon      for select using (id_usuario = auth.uid());
create policy "usuario_logro_sel"   on usuario_logro       for select using (id_usuario = auth.uid());
create policy "mov_xp_sel"          on movimiento_xp       for select using (id_usuario = auth.uid());
create policy "mov_credito_sel"     on movimiento_credito  for select using (id_usuario = auth.uid());
create policy "suscripcion_sel"     on suscripcion         for select using (id_usuario = auth.uid());

-- Preferencias: el usuario SÍ puede leer y actualizar su fila (equipar dragón/tema).
--   (la validación de "posee ese dragón" se hace en la RPC/app)
drop policy if exists "preferencia_sel"    on preferencia_usuario;
drop policy if exists "preferencia_upsert" on preferencia_usuario;
create policy "preferencia_sel" on preferencia_usuario
  for select using (id_usuario = auth.uid());
create policy "preferencia_upsert" on preferencia_usuario
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

-- NO se crean policies de INSERT/UPDATE para movimiento_xp, movimiento_credito,
-- usuario_dragon, usuario_logro ni suscripcion: esas escrituras SOLO pasan por
-- funciones SECURITY DEFINER, que ignoran RLS.


-- ============================================================
--  8. FUNCIONES RPC (guía — implementar en fase de build)
--  Van como SECURITY DEFINER para poder escribir en las tablas bloqueadas,
--  validando siempre auth.uid() adentro.
-- ============================================================
--
--  otorgar_recompensa(p_motivo text, p_xp int, p_creditos int,
--                     p_clave text, p_id_objetivo uuid, p_id_tarea uuid)
--    1) insert movimiento_xp      (... clave_idempotencia = p_clave) on conflict do nothing
--    2) insert movimiento_credito (... clave_idempotencia = p_clave) on conflict do nothing
--    3) recalcular perfil.xp_total, perfil.creditos, perfil.nivel
--    -> Se llama cuando registro_objetivo.completado pasa a true o tarea.completada a true.
--       (idealmente disparado por trigger/RPC, no por el cliente inventando montos)
--
--  comprar_dragon(p_id_dragon uuid)
--    ¿ya lo tiene?            -> error
--    ¿cumple la regla?        -> calcular desde historial (registro_objetivo, movimiento_xp)
--    ¿premium_required?       -> chequear suscripcion ACTIVE
--    ¿creditos >= credit_cost?-> si no, error
--    -> insert movimiento_credito (-credit_cost, DRAGON_PURCHASE, clave='compra:{id}')
--    -> insert usuario_dragon (credit_price_paid = credit_cost)
--    -> recalcular perfil.creditos
--    -> devolver ok para mostrar celebración
--
--  Reglas de producto:
--   · XP nunca baja (no punitivo).
--   · Si Premium vence: usuario_dragon PERMANECE; solo se impide equipar los premium.


-- ============================================================
--  9. SEED MÍNIMO (para probar el sistema de temas ya mismo)
--  Guardado con "where not exists" para no duplicar si se re-ejecuta.
-- ============================================================
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Original', '#7c3aed', '#3b82f6', '#a78bfa',
       '#faf6ef', '#ffffff', '#22c55e', '#e08a2c',
       '#241f38', '#84808a'
where not exists (select 1 from tema where nombre = 'Original');

insert into dragon (nombre, descripcion, asset_key, id_tema, credit_cost,
                    premium_required, es_inicial, activo, orden)
select 'Original', 'Tu dragón inicial', 'dragon_original', t.id_tema, 0,
       false, true, true, 1
from tema t
where t.nombre = 'Original'
  and not exists (select 1 from dragon where nombre = 'Original');

insert into dragon_regla_desbloqueo (id_dragon, rule_type, target_value)
select d.id_dragon, 'FREE', 0
from dragon d
where d.nombre = 'Original'
  and not exists (
    select 1 from dragon_regla_desbloqueo r where r.id_dragon = d.id_dragon
  );


-- ============================================================
--  10. ALTA DE USUARIO (reemplaza el trigger del esquema base)
--  Al registrarse: perfil + 4 categorías (como antes) y ADEMÁS
--  regala el dragón inicial y lo deja equipado en preferencia_usuario.
--  · Es SECURITY DEFINER -> puede escribir en usuario_dragon (RLS lo bloquea al cliente).
--  · El dragón inicial se busca por es_inicial=true (NUNCA hardcodeado por nombre).
--  · Si todavía no hay dragón inicial (seed no corrido), igual crea perfil+categorías.
--  Solo se REEMPLAZA la función; el trigger on_auth_user_created ya existe del base.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_id_dragon uuid;
  v_id_tema   uuid;
begin
  insert into perfil (id_usuario, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''));

  insert into categoria (id_usuario, nombre, icono, color) values
    (new.id, 'Fitness',     '🏋️', '#8B5CF6'),
    (new.id, 'Universidad', '🎓', '#22C55E'),
    (new.id, 'Personal',    '🙂', '#6366F1'),
    (new.id, 'Salud',       '❤️', '#EF4444');

  -- Dragón inicial (regalo) + su tema, equipados por defecto.
  select d.id_dragon, d.id_tema
    into v_id_dragon, v_id_tema
  from dragon d
  where d.es_inicial and d.activo
  order by d.orden nulls last
  limit 1;

  if v_id_dragon is not null then
    insert into usuario_dragon (id_usuario, id_dragon, credit_price_paid)
    values (new.id, v_id_dragon, 0)
    on conflict do nothing;

    insert into preferencia_usuario (id_usuario, id_dragon_seleccionado, id_tema_seleccionado)
    values (new.id, v_id_dragon, v_id_tema)
    on conflict (id_usuario) do nothing;
  end if;

  return new;
end;
$$;
