-- ============================================================
--  MIGRACIÓN ADITIVA — objetivos predeterminados (presets)
--  Correr en Supabase (SQL Editor). Es idempotente.
--
--  Idea: los objetivos "sugeridos" (Pasos / Calorías / Agua) son
--  objetivos NORMALES marcados con una clave. Activar = crear (o
--  reactivar) la fila; desactivar = activo=false (se conservan las
--  ediciones del usuario para cuando lo vuelva a activar).
-- ============================================================

-- 1. Columna: identifica de qué preset viene el objetivo.
--    NULL = objetivo común creado a mano.
alter table objetivo
  add column if not exists clave_preset text;

-- 2. Un solo objetivo por (usuario, preset). El índice parcial deja
--    libres los objetivos comunes (clave_preset is null) y garantiza
--    que reactivar encuentre siempre la MISMA fila (con sus ediciones).
create unique index if not exists uq_objetivo_preset_usuario
  on objetivo (id_usuario, clave_preset)
  where clave_preset is not null;

-- 3. (Opcional) valores permitidos, por prolijidad.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_clave_preset'
  ) then
    alter table objetivo
      add constraint chk_clave_preset
      check (clave_preset is null or clave_preset in ('pasos', 'calorias', 'agua'));
  end if;
end $$;

-- Después de correr esto conviene regenerar los tipos:
--   supabase gen types typescript ...  → lib/types.ts
