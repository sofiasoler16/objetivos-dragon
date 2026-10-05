-- Dado un logro, devuelve el dragón que regala (por rule_type), o nada si no regala ninguno.
-- Sirve para mostrar el cartel "¡Desbloqueaste el dragón X!" cuando un logro entrega un dragón.
create or replace function public.dragon_de_logro(p_id_logro uuid)
returns table (id_dragon uuid, asset_key text, nombre text, id_tema uuid)
language sql security definer set search_path = public stable
as $$
  select d.id_dragon, d.asset_key, d.nombre, d.id_tema
  from logro l
  join dragon_regla_desbloqueo rr on rr.rule_type = l.rule_type
  join dragon d on d.id_dragon = rr.id_dragon and d.activo
  where l.id_logro = p_id_logro
  limit 1;
$$;

grant execute on function public.dragon_de_logro(uuid) to authenticated;
