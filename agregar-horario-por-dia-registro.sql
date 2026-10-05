-- 2.d — Horario excepcional "solo por este día".
-- Guarda un horario puntual para un objetivo en una fecha concreta (ej: Coriza normalmente 15–16,
-- pero HOY 15:30–18), sin cambiar la rutina. NULL = usar el horario normal del objetivo ese día.
-- 🔒 No afecta el % ni las estadísticas (esas se calculan por cumplimiento, no por hora).

alter table registro_objetivo
  add column if not exists hora_inicio time,
  add column if not exists hora_fin    time;
