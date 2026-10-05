import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cerrarSesionCompras, configurarCompras, identificarUsuario } from '@/lib/compras';
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
  const usuarioComprasRef = useRef<string | null>(null);

  useEffect(() => {
    configurarCompras(); // RevenueCat, una sola vez (no-op si no hay cobro configurado).

    // Sesión inicial (persistida en AsyncStorage) + suscripción a cambios.
    obtenerSesion()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setCargando(false));

    const desuscribir = onCambioSesion(setSession);
    return desuscribir;
  }, []);

  // Asocia / desasocia las compras de RevenueCat con el usuario de Supabase.
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (userId === usuarioComprasRef.current) return;
    usuarioComprasRef.current = userId;
    if (userId) void identificarUsuario(userId);
    else void cerrarSesionCompras();
  }, [session]);

  return (
    <SessionContext.Provider value={{ session, cargando }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
