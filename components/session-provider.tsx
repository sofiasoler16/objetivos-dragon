import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { obtenerSesion, onCambioSesion } from '@/lib/data';

type SessionContextValue = {
  session: Session | null;
  cargando: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  cargando: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Sesión inicial (persistida en AsyncStorage) + suscripción a cambios.
    obtenerSesion()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setCargando(false));

    const desuscribir = onCambioSesion(setSession);
    return desuscribir;
  }, []);

  return (
    <SessionContext.Provider value={{ session, cargando }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
