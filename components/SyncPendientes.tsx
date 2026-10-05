import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { sincronizarPendientes } from '@/lib/data';

// Reenvía al servidor los cambios que se hicieron OFFLINE (marcar, completar, omitir…).
// Se dispara al montar (arranque de la app) y cada vez que la app vuelve al primer plano
// (patrón simple y robusto, sin módulos nativos). Además, cada guardado online exitoso empuja
// la cola por su cuenta. Tras sincronizar, invalida las vistas para que aparezcan el % y el XP reales.
export function SyncPendientes() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let vivo = true;
    const flush = () => {
      sincronizarPendientes()
        .then(() => {
          if (!vivo) return;
          for (const key of [
            ['pendientes'],
            ['esperados-hoy'],
            ['semanales-hoy'],
            ['tareas'],
            ['perfil-stats'],
            ['coleccion'],
            ['progreso-dias'],
            ['progreso-objetivos'],
            ['progreso-mes'],
          ]) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        })
        .catch(() => {});
    };

    flush(); // al arrancar la app
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') flush();
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, [queryClient]);

  return null;
}
