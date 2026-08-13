import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { listarObjetivosConDias, listarTareas } from '@/lib/data';
import { sincronizarRecordatorios } from '@/lib/notificaciones';
import { hoyISO } from '@/logic/fecha';
import { construirRecordatorios } from '@/logic/recordatorios';

/**
 * Componente invisible: mantiene las notificaciones locales en sincronía con los
 * objetivos y tareas. Reusa las queryKeys de las pantallas (['objetivos'], ['tareas'])
 * → cuando se crea/edita/completa algo y se invalidan, acá se reprograma solo.
 * Se monta una vez dentro del área logueada (layout de tabs).
 */
export function RecordatoriosSync() {
  const { data: objetivos } = useQuery({
    queryKey: ['objetivos'],
    queryFn: () => listarObjetivosConDias({ soloActivos: true }),
  });
  const { data: tareas } = useQuery({ queryKey: ['tareas'], queryFn: () => listarTareas() });

  useEffect(() => {
    if (!objetivos || !tareas) return;
    const recordatorios = construirRecordatorios(objetivos, tareas, hoyISO());
    sincronizarRecordatorios(recordatorios).catch((e) =>
      console.warn('No se pudieron sincronizar los recordatorios:', e),
    );
  }, [objetivos, tareas]);

  return null;
}
