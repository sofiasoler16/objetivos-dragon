-- ============================================================
--  TEST (seguro) — verifica la lógica de "elegir la versión de horario por fecha".
--  Corré este archivo en el SQL Editor de Supabase.
--  🔒 NO toca tu base: es una sola consulta con datos de EJEMPLO. No inserta ni borra nada.
--
--  Simula un objetivo con DOS versiones:
--    · V1 (vieja):  Mié (3) y Vie (5)  — desde hace 20 días
--    · V2 (nueva):  Mié (3), Vie (5) y Sáb (6)  — desde HOY
--  Usa la MISMA regla que objetivo_toca_dia: "la versión más reciente que ya regía ese día".
--
--  Esperado en el resultado:
--    · Sábado (Sat) ANTES de hoy  → toca = false  (regía V1, sin sábado) ✅
--    · Sábado (Sat) HOY o después → toca = true   (rige V2) ✅
--    · Miércoles/Viernes siempre  → toca = true (en las dos versiones)
-- ============================================================

with versiones(desde, dias) as (
  values
    (current_date - 20, array[3, 5]),      -- V1 vieja: Mié, Vie
    (current_date,       array[3, 5, 6])    -- V2 nueva (desde hoy): Mié, Vie, Sáb
),
dias_prueba as (
  select g::date as fecha
  from generate_series(current_date - 10, current_date + 3, interval '1 day') g
)
select
  d.fecha,
  to_char(d.fecha, 'Dy')     as dia,
  (d.fecha >= current_date)  as hoy_o_futuro,
  (
    select extract(isodow from d.fecha)::int = any(v.dias)
    from versiones v
    where v.desde <= d.fecha
    order by v.desde desc
    limit 1
  )                          as toca
from dias_prueba d
order by d.fecha;
