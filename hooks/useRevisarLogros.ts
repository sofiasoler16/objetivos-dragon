import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { celebrarDragon } from '@/components/CelebracionDragon';
import { dragonDeLogroSeguro, evaluarLogrosSeguro } from '@/lib/data';

/**
 * Devuelve una función para llamar DESPUÉS de completar algo: revisa el historial,
 * desbloquea logros nuevos y —si hubo— avisa. Si el logro REGALA un dragón, muestra el
 * cartel del dragón ("¡Desbloqueaste el dragón X!"); si no, un Alert de logro 🏆.
 * Best-effort: si falla, no rompe el flujo de completar.
 */
export function useRevisarLogros() {
  const queryClient = useQueryClient();
  return async () => {
    const nuevos = await evaluarLogrosSeguro();
    if (nuevos.length === 0) return;
    queryClient.invalidateQueries({ queryKey: ['perfil-stats'] });
    queryClient.invalidateQueries({ queryKey: ['coleccion'] });
    queryClient.invalidateQueries({ queryKey: ['logros'] });

    const sinDragon: typeof nuevos = [];
    for (const l of nuevos) {
      const drag = await dragonDeLogroSeguro(l.id_logro);
      if (drag) {
        celebrarDragon({
          idDragon: drag.id_dragon,
          assetKey: drag.asset_key,
          nombre: drag.nombre,
          idTema: drag.id_tema,
          tipo: 'desbloqueado',
          logro: l.nombre,
        });
      } else {
        sinDragon.push(l);
      }
    }

    if (sinDragon.length > 0) {
      const l = sinDragon[0];
      const resto = sinDragon.length - 1;
      const cuerpo =
        `${l.nombre}` +
        (l.descripcion ? `\n${l.descripcion}` : '') +
        `\n\n+${l.xp_reward} XP · +${l.credit_reward} 🪙` +
        (resto > 0 ? `\n\n(y ${resto} logro${resto > 1 ? 's' : ''} más)` : '');
      Alert.alert('¡Logro desbloqueado! 🏆', cuerpo);
    }
  };
}
