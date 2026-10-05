import { useQuery } from '@tanstack/react-query';
import { usePremium } from '@/hooks/usePremium';
import { assetKeyEquipado } from '@/lib/data';

/**
 * asset_key del dragón equipado. Lo usan el botón de la barra, el hero de Hoy y las
 * mascotas de Objetivos/Progreso, para que al equipar otro dragón cambien todas.
 * Query key ['dragon-equipado', esPremium] → se refresca al equipar Y al cambiar el Premium
 * (si perdés Premium y tenías un dragón premium, vuelve a mostrar el Original).
 */
export function useDragonEquipado(): string | undefined {
  const { esPremium } = usePremium();
  const { data } = useQuery({ queryKey: ['dragon-equipado', esPremium], queryFn: assetKeyEquipado });
  return data;
}
