-- ============================================================
--  OPCIÓN B — Historial de horarios — PARTE 2: versionado desde el cliente
--  Corré este archivo en el SQL Editor de Supabase (después de objetivo-horario-motor.sql).
--
--   · versionar_historico(objetivo, frecuencia, dias)  → el horario nuevo aplica a TODO el historial
--       (colapsa a una sola versión desde el inicio del objetivo).
--   · versionar_desde_hoy(objetivo, frecuencia, dias)  → conserva lo viejo y agrega una versión
--       vigente desde HOY (los días pasados siguen con la versión anterior).
--
--  🔒 El cliente llama a estas ANTES de pisar objetivo_dia (así la versión base captura los días viejos).
-- ============================================================

-- El horario nuevo vale para todo el historial → una sola versión desde el inicio.
create or replace function public.versionar_historico(
  p_objetivo uuid, p_frecuencia text, p_dias int[]
)
returns void language plpgsql security definer set search_path = public as $$
declare v_inicio date;
begin
  if not exists (select 1 from objetivo where id_objetivo = p_objetivo and id_usuario = auth.uid()) then
    raise exception 'No es tu objetivo';
  end if;
  select coalesce(fecha_inicio, fecha_creacion::date) into v_inicio
  from objetivo where id_objetivo = p_objetivo;

  delete from objetivo_horario where id_objetivo = p_objetivo;
  if p_frecuencia in ('DAILY', 'SPECIFIC_DAYS') then
    insert into objetivo_horario (id_objetivo, desde, frecuencia_tipo, dias)
    values (p_objetivo, v_inicio, p_frecuencia::frecuencia_tipo,
            case when p_frecuencia = 'SPECIFIC_DAYS' then p_dias else null end);
  end if;
end;
$$;
grant execute on function public.versionar_historico(uuid, text, int[]) to authenticated;

-- El horario nuevo vale de HOY en adelante → conserva lo viejo, agrega una versión desde hoy.
create or replace function public.versionar_desde_hoy(
  p_objetivo uuid, p_frecuencia text, p_dias int[]
)
returns void language plpgsql security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
        v_inicio date;
        v_frec_actual frecuencia_tipo;
begin
  if not exists (select 1 from objetivo where id_objetivo = p_objetivo and id_usuario = auth.uid()) then
    raise exception 'No es tu objetivo';
  end if;
  select coalesce(fecha_inicio, fecha_creacion::date), frecuencia_tipo
  into v_inicio, v_frec_actual
  from objetivo where id_objetivo = p_objetivo;

  -- Asegurar una versión BASE (config vieja/actual) para que el pasado NO use la config nueva.
  -- Se corre ANTES de que el cliente pise objetivo_dia → acá objetivo_dia todavía tiene lo viejo.
  if not exists (select 1 from objetivo_horario where id_objetivo = p_objetivo and desde <= v_inicio) then
    insert into objetivo_horario (id_objetivo, desde, frecuencia_tipo, dias)
    values (p_objetivo, v_inicio, v_frec_actual,
            case when v_frec_actual = 'SPECIFIC_DAYS'
                 then (select array_agg(od.dia_semana order by od.dia_semana)
                       from objetivo_dia od where od.id_objetivo = p_objetivo)
                 else null end);
  end if;

  -- Upsert de la versión de HOY con la config nueva.
  delete from objetivo_horario where id_objetivo = p_objetivo and desde = v_hoy;
  if p_frecuencia in ('DAILY', 'SPECIFIC_DAYS') then
    insert into objetivo_horario (id_objetivo, desde, frecuencia_tipo, dias)
    values (p_objetivo, v_hoy, p_frecuencia::frecuencia_tipo,
            case when p_frecuencia = 'SPECIFIC_DAYS' then p_dias else null end);
  end if;
end;
$$;
grant execute on function public.versionar_desde_hoy(uuid, text, int[]) to authenticated;
