import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { aplicarCongeladores } from '@/lib/data';

/**
 * Aplica los congeladores de racha en el server (automático). Si se usó alguno para tapar un día
 * salteado, avisa y refresca la racha / stats. Best-effort: si falla, no rompe nada.
 * Llamar al abrir la app (idempotente: un día ya protegido no se vuelve a congelar).
 */
export function useRevisarCongeladores() {
  const queryClient = useQueryClient();
  return async () => {
    const usados = await aplicarCongeladores();
    if (usados <= 0) return;
    for (const k of [['progreso-racha'], ['progreso-dias'], ['congeladas'], ['perfil-stats'], ['congeladores']])
      queryClient.invalidateQueries({ queryKey: k });
    Alert.alert(
      '🧊 Racha protegida',
      usados === 1
        ? 'Se usó un congelador para tapar el día que te salteaste. ¡Tu racha sigue viva! 🔥'
        : `Se usaron ${usados} congeladores para tapar los días salteados. ¡Tu racha sigue viva! 🔥`,
    );
  };
}
