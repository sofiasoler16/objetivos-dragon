-- ============================================================
--  Esquema de base de datos
--  App de objetivos, hábitos y tareas (dragón mascota)
--  Motor: PostgreSQL  ·  pensado para Supabase
--  Convenciones:
--    - identificadores en español
--    - semana ISO: lunes = 1 ... domingo = 7 (coincide con isodow)
--    - "hoy" siempre se calcula en la zona horaria del usuario,
--      no en UTC (ver query de ejemplo al final)
-- ============================================================


-- ============================================================
--  1. ENUMS
-- ============================================================
create type tipo_objetivo    as enum ('BOOLEAN', 'NUMERIC');            -- 'DURATION' a futuro
create type frecuencia_tipo  as enum ('DAILY', 'SPECIFIC_DAYS', 'WEEKLY_COUNT');
create type prioridad_tarea  as enum ('BAJA', 'MEDIA', 'ALTA');
create type fuente_datos     as enum ('MANUAL', 'HEALTH_CONNECT');      -- HEALTH_CONNECT para V2


-- ============================================================
--  2. PERFIL
--  Con Supabase Auth NO se guarda password_hash: la identidad
--  vive en auth.users. 'perfil' extiende ese usuario con datos
--  propios de la app.
-- ============================================================
create table perfil (
  id_usuario     uuid primary key references auth.users(id) on delete cascade,
  nombre         text,
  fecha_creacion timestamptz not null default now()
);


-- ============================================================
--  3. CATEGORIA   (Usuario 1 : N Categoria)
-- ============================================================
create table categoria (
  id_categoria   uuid primary key default gen_random_uuid(),
  id_usuario     uuid not null references perfil(id_usuario) on delete cascade,
  nombre         text not null,
  icono          text,
  color          text,
  fecha_creacion timestamptz not null default now()
);
create index idx_categoria_usuario on categoria(id_usuario);


-- ============================================================
--  4. OBJETIVO   (lo que la persona QUIERE hacer)
-- ============================================================
create table objetivo (
  id_objetivo         uuid primary key default gen_random_uuid(),
  id_usuario          uuid not null references perfil(id_usuario) on delete cascade,
  id_categoria        uuid references categoria(id_categoria) on delete set null,
  nombre              text not null,
  descripcion         text,
  tipo                tipo_objetivo   not null,
  frecuencia_tipo     frecuencia_tipo not null,
  frecuencia_cantidad smallint,          -- solo WEEKLY_COUNT (ej: 3 veces/semana)
  meta_valor          numeric,           -- solo NUMERIC (ej: 2000)
  unidad              text,              -- 'ml','g','pasos','min','km'...
  fuente_datos        fuente_datos not null default 'MANUAL',
  hora_recordatorio   time,
  fecha_inicio        date not null default current_date,
  fecha_fin           date,
  activo              boolean not null default true,
  fecha_creacion      timestamptz not null default now(),

  -- coherencia según el tipo/frecuencia
  constraint chk_weekly_count check (
    frecuencia_tipo <> 'WEEKLY_COUNT' or frecuencia_cantidad is not null
  ),
  constraint chk_numeric_meta check (
    tipo <> 'NUMERIC' or meta_valor is not null
  )
);
create index idx_objetivo_usuario on objetivo(id_usuario, activo);


-- ============================================================
--  5. OBJETIVO_DIA   (solo para frecuencia SPECIFIC_DAYS)
--  dia_semana ISO: 1=lunes ... 7=domingo
--  NO se guarda "lunes,martes,jueves" como string.
-- ============================================================
create table objetivo_dia (
  id_objetivo uuid not null references objetivo(id_objetivo) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 1 and 7),
  primary key (id_objetivo, dia_semana)
);


-- ============================================================
--  6. REGISTRO_OBJETIVO   (lo que la persona REALMENTE hizo)
--  Fuente de verdad para TODA estadística de progreso.
-- ============================================================
create table registro_objetivo (
  id_registro         uuid primary key default gen_random_uuid(),
  id_objetivo         uuid not null references objetivo(id_objetivo) on delete cascade,
  fecha               date not null,
  valor               numeric,             -- para NUMERIC (ej: 1500 de agua)
  completado          boolean not null default false,
  omitido             boolean not null default false,  -- fuera del cálculo (no penaliza)
  fecha_actualizacion timestamptz not null default now(),

  -- un único registro por objetivo y día -> habilita UPSERT limpio
  constraint uq_registro_objetivo_fecha unique (id_objetivo, fecha)
);
create index idx_registro_objetivo_fecha on registro_objetivo(id_objetivo, fecha);


-- ============================================================
--  7. TAREA   (obligación puntual, se completa una sola vez)
-- ============================================================
create table tarea (
  id_tarea         uuid primary key default gen_random_uuid(),
  id_usuario       uuid not null references perfil(id_usuario) on delete cascade,
  id_categoria     uuid references categoria(id_categoria) on delete set null,
  titulo           text not null,
  descripcion      text,
  fecha_limite     date,
  hora_limite      time,
  prioridad        prioridad_tarea not null default 'MEDIA',
  completada       boolean not null default false,
  fecha_completada timestamptz,
  fecha_creacion   timestamptz not null default now()
);
create index idx_tarea_usuario on tarea(id_usuario, completada, fecha_limite);


-- ============================================================
--  8. ROW LEVEL SECURITY  (cada usuario ve solo lo suyo)
-- ============================================================
alter table perfil            enable row level security;
alter table categoria         enable row level security;
alter table objetivo          enable row level security;
alter table objetivo_dia      enable row level security;
alter table registro_objetivo enable row level security;
alter table tarea             enable row level security;

-- dueño directo
create policy "perfil_propio" on perfil
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

create policy "categoria_propia" on categoria
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

create policy "objetivo_propio" on objetivo
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

create policy "tarea_propia" on tarea
  for all using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

-- dueño a través del objetivo padre
create policy "objetivo_dia_propio" on objetivo_dia
  for all
  using (exists (
    select 1 from objetivo o
    where o.id_objetivo = objetivo_dia.id_objetivo and o.id_usuario = auth.uid()
  ))
  with check (exists (
    select 1 from objetivo o
    where o.id_objetivo = objetivo_dia.id_objetivo and o.id_usuario = auth.uid()
  ));

create policy "registro_objetivo_propio" on registro_objetivo
  for all
  using (exists (
    select 1 from objetivo o
    where o.id_objetivo = registro_objetivo.id_objetivo and o.id_usuario = auth.uid()
  ))
  with check (exists (
    select 1 from objetivo o
    where o.id_objetivo = registro_objetivo.id_objetivo and o.id_usuario = auth.uid()
  ));


-- ============================================================
--  9. ALTA DE USUARIO
--  Al crearse en auth.users: crea perfil + 4 categorías por defecto.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into perfil (id_usuario, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''));

  insert into categoria (id_usuario, nombre, icono, color) values
    (new.id, 'Fitness',     '🏋️', '#8B5CF6'),
    (new.id, 'Universidad', '🎓', '#22C55E'),
    (new.id, 'Personal',    '🙂', '#6366F1'),
    (new.id, 'Salud',       '❤️', '#EF4444');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
--  10. EJEMPLO — "objetivos esperados hoy"  (corazón de la pantalla Hoy)
--  DAILY siempre; SPECIFIC_DAYS si el día coincide.
--  WEEKLY_COUNT se resuelve aparte (progreso semanal, tarjeta opcional).
--  "hoy" se calcula en la zona horaria del usuario, NO en UTC.
-- ============================================================
-- select o.*
-- from objetivo o
-- where o.id_usuario = auth.uid()
--   and o.activo
--   and o.fecha_inicio <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
--   and (o.fecha_fin is null
--        or o.fecha_fin >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
--   and (
--     o.frecuencia_tipo = 'DAILY'
--     or (
--       o.frecuencia_tipo = 'SPECIFIC_DAYS'
--       and exists (
--         select 1 from objetivo_dia d
--         where d.id_objetivo = o.id_objetivo
--           and d.dia_semana = extract(isodow from
--                (now() at time zone 'America/Argentina/Buenos_Aires')::date)
--       )
--     )
--   );
