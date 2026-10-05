import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mostrarNotifCronometro, ocultarNotifCronometro } from '@/lib/cronometro-notif';

const CLAVE = 'cronometro_v1';

/** Cronómetro activo de un objetivo de DURACIÓN. `inicioMs` = Date.now() al arrancar. */
export type CronoActivo = {
  id: string;
  fecha: string;
  nombre: string;
  meta: number | null;
  /** true = meta semanal acumulada (suma al valor sin marcar completado por día). */
  semanal?: boolean;
  inicioMs: number;
};

/** Minutos transcurridos desde el inicio (redondeados al minuto). */
export function minutosDesde(inicioMs: number, ahoraMs = Date.now()): number {
  return Math.round((ahoraMs - inicioMs) / 60000);
}

/**
 * Cronómetro único (uno a la vez) para objetivos de duración. Persiste en el teléfono, así que
 * SOBREVIVE cerrar/reabrir la app (al volver sigue contando desde `inicioMs`). Al detener —o al
 * arrancar otro— hace commit de los minutos vía `onCommit`.
 */
export function useCronometro(onCommit: (c: CronoActivo, minutos: number) => void) {
  const [activo, setActivo] = useState<CronoActivo | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Cargar el cronómetro persistido al montar (sobrevive cerrar la app) y re-mostrar su notificación.
  useEffect(() => {
    AsyncStorage.getItem(CLAVE).then((v) => {
      if (!v) return;
      try {
        const parsed: CronoActivo = JSON.parse(v);
        setActivo(parsed);
        mostrarNotifCronometro(parsed.nombre, parsed.inicioMs);
      } catch {
        /* ignorar */
      }
    });
  }, []);

  // Tick cada segundo mientras hay uno activo (para el display en vivo).
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activo]);

  const commit = (c: CronoActivo) => {
    const min = minutosDesde(c.inicioMs);
    if (min > 0) onCommitRef.current(c, min);
    AsyncStorage.removeItem(CLAVE).catch(() => {});
  };

  const detener = useCallback(() => {
    setActivo((prev) => {
      if (prev) commit(prev);
      return null;
    });
    ocultarNotifCronometro();
  }, []);

  const iniciar = useCallback((c: Omit<CronoActivo, 'inicioMs'>) => {
    const nuevo: CronoActivo = { ...c, inicioMs: Date.now() };
    setActivo((prev) => {
      if (prev) commit(prev); // había otro corriendo → cerrarlo antes
      AsyncStorage.setItem(CLAVE, JSON.stringify(nuevo)).catch(() => {});
      return nuevo;
    });
    mostrarNotifCronometro(nuevo.nombre, nuevo.inicioMs);
  }, []);

  const segundos = activo ? Math.max(0, Math.floor((ahora - activo.inicioMs) / 1000)) : 0;
  return { activo, segundos, iniciar, detener };
}
