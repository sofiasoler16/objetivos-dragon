-- ============================================================
--  Item 4 — Límite mensual de IA (150/mes, server-side).
--  🔒 El conteo y el bloqueo son server-side (RPC SECURITY DEFINER + RLS). El cliente NO puede
--     escribir `uso_ia` directo, solo leer lo propio. El mes es CALENDARIO (zona del usuario).
-- ============================================================

create table if not exists uso_ia (
  id_usuario uuid  not null references auth.users(id) on delete cascade,
  mes        text  not null,               -- 'YYYY-MM' (mes calendario, zona Buenos Aires)
  cantidad   int   not null default 0,
  primary key (id_usuario, mes)
);

alter table uso_ia enable row level security;

-- Leer SOLO lo propio (para el contador "N/150"). Sin insert/update/delete directos del cliente.
drop policy if exists "uso_ia_propio_select" on uso_ia;
create policy "uso_ia_propio_select" on uso_ia for select using (id_usuario = auth.uid());

-- Límite mensual (una sola fuente de verdad).
create or replace function limite_ia() returns int language sql immutable as $$ select 150 $$;

-- Consume 1 uso del mes en curso. Si ya llegó al límite, NO incrementa. Devuelve el estado.
create or replace function consumir_ia()
returns table(permitido boolean, usados int, limite int)
language plpgsql security definer set search_path = public as $$
declare
  v_mes    text := to_char((now() at time zone 'America/Argentina/Buenos_Aires'), 'YYYY-MM');
  v_lim    int  := limite_ia();
  v_actual int;
begin
  if auth.uid() is null then
    return query select false, 0, v_lim; return;
  end if;
  insert into uso_ia (id_usuario, mes, cantidad) values (auth.uid(), v_mes, 0)
    on conflict (id_usuario, mes) do nothing;
  select cantidad into v_actual from uso_ia
    where id_usuario = auth.uid() and mes = v_mes for update;
  if v_actual >= v_lim then
    return query select false, v_actual, v_lim;
  else
    update uso_ia set cantidad = cantidad + 1 where id_usuario = auth.uid() and mes = v_mes;
    return query select true, v_actual + 1, v_lim;
  end if;
end $$;

-- Lee el uso del mes en curso SIN consumir (para el contador de la app).
create or replace function uso_ia_actual()
returns table(usados int, limite int)
language plpgsql security definer set search_path = public as $$
declare
  v_mes text := to_char((now() at time zone 'America/Argentina/Buenos_Aires'), 'YYYY-MM');
begin
  return query select
    coalesce((select cantidad from uso_ia where id_usuario = auth.uid() and mes = v_mes), 0),
    limite_ia();
end $$;

grant execute on function consumir_ia()   to authenticated;
grant execute on function uso_ia_actual()  to authenticated;
grant execute on function limite_ia()      to authenticated;
