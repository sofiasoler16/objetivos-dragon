-- ============================================================
--  SEED — dragón PHOENIX 🔥  (REGALO del logro "Imparable", racha de 7 días)
--  · asset_key = 'dragon_phoenix' → constants/dragons.ts (DRAGON_ART).
--  · Tema 'Fénix': claro cálido (crema) + fuego naranja-rojo (= borde de tarjeta) +
--    acento dorado. NO se compra: lo regala evaluar_logros al desbloquear "Imparable".
--  Idempotente (where not exists). El seed original vivía en agregar-congeladores.sql;
--  este archivo queda como referencia de los colores actuales del tema.
-- ============================================================

-- Tema Fénix: base clara cálida, primario fuego (borde de tarjeta), acento dorado.
insert into tema (nombre, primary_color, secondary_color, accent_color,
                  background_color, surface_color, success_color, warning_color,
                  text_primary, text_secondary)
select 'Fénix', '#e0512a', '#e8833a', '#ffb300',
       '#fff6f0', '#ffffff', '#22c55e', '#e08a2c',
       '#2a1712', '#8a6f63'
where not exists (select 1 from tema where nombre = 'Fénix');
