// Componente invisible: decide cuándo abrir el paywall Premium SOLO (promo de prueba gratis).
// Regla: si el usuario NO es Premium y ya vio el tutorial → mostrar al terminar el tutorial
// y luego cada 7 días (ver lib/promoPremium). No se apila sobre el onboarding (chequea que
// ya esté visto) y se dispara una sola vez por sesión.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { onboardingVisto, onOnboardingCerrado } from '@/components/Onboarding';
import { usePremium } from '@/hooks/usePremium';
import { debeMostrarPromo, marcarPromoMostrada } from '@/lib/promoPremium';

export function PromoPremium() {
  const { esPremium, cargando } = usePremium();
  const yaMostro = useRef(false);

  const chequear = useCallback(async () => {
    if (yaMostro.current) return; // una sola vez por sesión
    if (cargando || esPremium) return; // Premium o todavía cargando → no molestar
    if (!(await onboardingVisto())) return; // no tapar el tutorial
    if (!(await debeMostrarPromo())) return; // aún no pasaron 7 días
    yaMostro.current = true;
    await marcarPromoMostrada();
    // Pequeño delay para no chocar con la transición de pantalla al abrir la app / cerrar el tutorial.
    setTimeout(() => router.push('/premium'), 450);
  }, [cargando, esPremium]);

  // Al abrir la app (cuando ya se sabe si es Premium).
  useEffect(() => {
    chequear();
  }, [chequear]);

  // Y justo cuando se cierra el tutorial (primera vez).
  useEffect(() => onOnboardingCerrado(() => chequear()), [chequear]);

  return null;
}
