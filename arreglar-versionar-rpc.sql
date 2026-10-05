-- ============================================================
--  FIX — versionar_historico / versionar_desde_hoy: parámetro de frecuencia como TEXT
--  Corré este archivo en el SQL Editor de Supabase.
--
--  Problema: las funciones usaban el tipo enum `frecuencia_tipo` como parámetro. PostgREST (la capa
--  que expone las RPC a la app) no matchea el enum cuando la app manda el valor como texto → error
--  PGRST202 "Could not find the function ... in the schema cache".
--  Solución: recibir `p_frecuencia text` y castear a enum adentro. (Se borran las versiones enum.)
-- ============================================================

drop function if exists public.versionar_historico(uuid, frecuencia_tipo, int[]);
drop function if exists public.versionar_desde_hoy(uuid, frecuencia_tipo, int[]);

-- Histórico: el horario nuevo aplica a TODO → una sola versión desde el inicio.
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

-- De hoy en adelante: conserva lo viejo, agrega una versión desde hoy.
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

-- Refrescar el cache de esquema de PostgREST para que tome las funciones nuevas ya.
notify pgrst, 'reload schema';
