import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { type CronoActivo, useCronometro } from '@/hooks/useCronometro';
import { useRevisarLogros } from '@/hooks/useRevisarLogros';
import { sumarValorHoy, sumarValorNumerico } from '@/lib/data';

type Ctx = {
  activo: CronoActivo | null;
  segundos: number;
  iniciar: (c: Omit<CronoActivo, 'inicioMs'>) => void;
  detener: () => void;
};

const CronometroContext = createContext<Ctx | null>(null);

/**
 * Cronómetro ÚNICO compartido por toda la app (Hoy + la pantalla de foco usan el mismo timer).
 * Al detener, hace commit de los minutos: semanal → suma al valor (sin recompensa por día);
 * diario → suma y marca completado/recompensa si llega a la meta. Refresca Hoy/Progreso y logros.
 */
export function CronometroProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const revisarLogros = useRevisarLogros();

  const onCommit = useCallback(
    async (c: CronoActivo, minutos: number) => {
      try {
        if (c.semanal) await sumarValorHoy(c.id, c.fecha, minutos);
        else await sumarValorNumerico(c.id, c.fecha, minutos, c.meta);
      } catch {
        /* best-effort: no romper si falla el guardado */
      }
      for (const k of [
        ['esperados-hoy'],
        ['semanales-hoy'],
        ['progreso-dias'],
        ['progreso-mes'],
        ['detalle-dia'],
        ['perfil-stats'],
        ['coleccion'],
      ])
        queryClient.invalidateQueries({ queryKey: k });
      revisarLogros();
    },
    [queryClient, revisarLogros],
  );

  const crono = useCronometro(onCommit);
  return <CronometroContext.Provider value={crono}>{children}</CronometroContext.Provider>;
}

export function useCronometroCtx(): Ctx {
  const ctx = useContext(CronometroContext);
  if (!ctx) throw new Error('useCronometroCtx debe usarse dentro de <CronometroProvider>');
  return ctx;
}
