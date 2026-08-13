import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { evaluarLogrosSeguro } from '@/lib/data';

/**
 * Devuelve una función para llamar DESPUÉS de completar algo: revisa el historial,
 * desbloquea logros nuevos y —si hubo— celebra con un aviso e invalida las queries
 * de perfil/colección/logros. Best-effort: si falla, no rompe el flujo de completar.
 */
export function useRevisarLogros() {
  const queryClient = useQueryClient();
  return async () => {
    const nuevos = await evaluarLogrosSeguro();
    if (nuevos.length === 0) return;
    queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
    queryClient.invalidateQueries({ queryKey: ['coleccion'] });
    queryClient.invalidateQueries({ queryKey: ['logros'] });

    const l = nuevos[0];
    const resto = nuevos.length - 1;
    const cuerpo =
      `${l.nombre}` +
      (l.descripcion ? `\n${l.descripcion}` : '') +
      `\n\n+${l.xp_reward} XP · +${l.credit_reward} 🪙` +
      (resto > 0 ? `\n\n(y ${resto} logro${resto > 1 ? 's' : ''} más)` : '');
    Alert.alert('¡Logro desbloqueado! 🏆', cuerpo);
  };
}
