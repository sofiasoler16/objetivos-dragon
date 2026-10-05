-- ============================================================
--  FIX — El dragón Fénix 🔥 debe desbloquearse con "Imparable" (racha 7), no con "En racha" (3)
--  Corré este archivo en el SQL Editor de Supabase.
--
--  La regla del Fénix había quedado en RACHA target 3 (En racha) → por eso el logro "En racha"
--  decía que daba el Fénix, y al reclamarlo mencionaba ese logro. Lo movemos a RACHA target 7
--  (Imparable), que es el diseño correcto. (El dragón que ya tengas en tu colección se conserva.)
-- ============================================================

update dragon_regla_desbloqueo
set rule_type = 'RACHA', target_value = 7, percentage_required = null
where id_dragon = (select id_dragon from dragon where asset_key = 'dragon_phoenix');
