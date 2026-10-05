-- ============================================================
--  Cambiar el precio (monedas) de Arcoíris, Programador y Samurái: 150 → 250.
--  Corré este archivo en el SQL Editor de Supabase.
--  (Siguen siendo premium; solo cambia cuántas monedas cuestan.)
-- ============================================================

update dragon
set credit_cost = 250
where asset_key in ('dragon_arcoiris', 'dragon_programador', 'dragon_samurai');
