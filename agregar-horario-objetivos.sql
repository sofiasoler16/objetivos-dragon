-- Migración aditiva: "objetivos con horario" (se agendan como evento en el calendario).
-- Un objetivo/tarea con hora_inicio + hora_fin se refleja como evento en la capa
-- "Objetivos Dragón" del calendario. id_evento_calendario guarda el id del evento espejo
-- (para poder editarlo/borrarlo). Sin hora_inicio → objetivo normal del día (sin evento).
-- Es aditiva e idempotente: se puede correr sin romper nada existente.

alter table objetivo add column if not exists hora_inicio time;
alter table objetivo add column if not exists hora_fin time;
alter table objetivo add column if not exists id_evento_calendario text;

alter table tarea add column if not exists hora_inicio time;
alter table tarea add column if not exists hora_fin time;
alter table tarea add column if not exists id_evento_calendario text;
