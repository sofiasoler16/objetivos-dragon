-- ============================================================
--  Alinear el tema "Original" de la base con la paleta actual de la app
--  (el fondo pasó a verde muy claro). Sin esto, equipar el dragón Original
--  pintaría el fondo con el crema viejo. Correr una sola vez.
-- ============================================================
update tema set
  primary_color    = '#7c3aed',
  secondary_color  = '#3b82f6',
  accent_color     = '#a78bfa',
  background_color = '#f1f8f3',
  surface_color    = '#ffffff',
  success_color    = '#22c55e',
  warning_color    = '#e08a2c',
  text_primary     = '#241f38',
  text_secondary   = '#84808a'
where nombre = 'Original';
