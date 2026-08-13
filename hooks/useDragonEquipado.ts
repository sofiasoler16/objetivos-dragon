import { useQuery } from '@tanstack/react-query';
import { assetKeyEquipado } from '@/lib/data';

/**
 * asset_key del dragón equipado. Lo usan el botón de la barra, el hero de Hoy y las
 * mascotas de Objetivos/Progreso, para que al equipar otro dragón cambien todas.
 * Query key ['dragon-equipado'] → se invalida al equipar.
 */
export function useDragonEquipado(): string | undefined {
  const { data } = useQuery({ queryKey: ['dragon-equipado'], queryFn: assetKeyEquipado });
  return data;
}
