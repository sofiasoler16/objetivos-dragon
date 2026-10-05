-- ============================================================
--  GRUPOS — Paso 20 (Tema 2): puntaje TOTAL por miembro (ranking "quién hizo más")
--  Corré este archivo en el SQL Editor de Supabase (después del 17/18/19).
--
--  A diferencia del saldo canjeable (puntos_miembros_grupo, que BAJA al canjear), este puntaje
--  suma SOLO lo ganado por cumplir (motivo = 'cumplimiento') → nunca baja. Es para el ranking
--  "quién hizo más tareas en general" en la pantalla de Progreso del grupo.
-- ============================================================

create or replace function public.puntaje_total_miembros(p_grupo uuid)
returns table (id_miembro uuid, nombre text, es_yo boolean, puntaje int)
language sql security definer set search_path = public stable as $$
  select m.id_miembro,
         coalesce(nullif(trim(p.nombre), ''), nullif(trim(m.nombre_visible), ''),
                  nullif(split_part(u.email, '@', 1), ''), 'Miembro') as nombre,
         coalesce(m.id_usuario = auth.uid(), false) as es_yo,
         coalesce((select sum(pg.puntos) from punto_grupo pg
                   where pg.id_grupo = p_grupo and pg.id_usuario = m.id_usuario
                     and pg.motivo = 'cumplimiento'), 0)::int as puntaje
  from miembro_grupo m
  left join perfil p     on p.id_usuario = m.id_usuario
  left join auth.users u on u.id = m.id_usuario
  where m.id_grupo = p_grupo and es_miembro_grupo(p_grupo, auth.uid())
  order by puntaje desc, nombre;
$$;
grant execute on function public.puntaje_total_miembros(uuid) to authenticated;
