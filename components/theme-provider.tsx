import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext } from 'react';
import { useSession } from '@/components/session-provider';
import { type Tema, TEMA_ORIGINAL } from '@/constants/theme';
import { usePremium } from '@/hooks/usePremium';
import { temaActivo } from '@/lib/data';
import { temaAColores } from '@/logic/tema';

// Provee la paleta activa (según el dragón equipado) a toda la app. `useTheme()`
// devuelve los colores; al equipar otro dragón se invalida ['tema-activo'] y la app
// se redibuja sola. Fallback: TEMA_ORIGINAL (sin sesión / mientras carga).
// La key incluye el user id → al iniciar/cerrar sesión, re-lee el tema equipado.
const ThemeContext = createContext<Tema>(TEMA_ORIGINAL);

export function useTheme(): Tema {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  // Depende del Premium: si perdés Premium y tenías un tema premium, vuelve al Original.
  const { esPremium } = usePremium();
  const { data } = useQuery({
    queryKey: ['tema-activo', session?.user.id ?? null, esPremium],
    queryFn: temaActivo,
  });
  const colores = data ? temaAColores(data) : TEMA_ORIGINAL;
  return <ThemeContext.Provider value={colores}>{children}</ThemeContext.Provider>;
}
