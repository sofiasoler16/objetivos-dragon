import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CronometroProvider } from '@/components/cronometro-provider';
import { SessionProvider, useSession } from '@/components/session-provider';
import { ThemeProvider as DragonThemeProvider } from '@/components/theme-provider';

SplashScreen.preventAutoHideAsync();

// gcTime largo: el cache sobrevive en memoria el tiempo suficiente para persistirse y
// poder VERSE offline (sin esto, React Query lo descarta a los 5 min y no queda nada guardado).
const UNA_SEMANA = 1000 * 60 * 60 * 24 * 7;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: UNA_SEMANA,
      staleTime: 1000 * 30, // al reabrir con internet, refresca enseguida
      retry: 2,
    },
  },
});

// Persistimos el cache en el teléfono (AsyncStorage) → al abrir la app sin internet se ve
// lo último cargado en vez de pantalla vacía. Es puro JS (sin módulo nativo).
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'DRAKOSTONE_QUERY_CACHE',
  throttleTime: 1000,
});

function RootNavigator() {
  const { session, cargando } = useSession();
  const segments = useSegments();
  const router = useRouter();
  // Para limpiar el cache persistido cuando cambia el usuario (o cierra sesión).
  const usuarioRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Ocultamos el splash recién cuando sabemos si hay sesión o no.
    if (!cargando) SplashScreen.hideAsync();
  }, [cargando]);

  useEffect(() => {
    if (cargando) return;
    const uid = session?.user.id ?? null;
    if (usuarioRef.current === undefined) {
      // Primer arranque: conservamos lo persistido de ESTE usuario (para verlo offline).
      usuarioRef.current = uid;
      return;
    }
    if (usuarioRef.current !== uid) {
      // Cambió de cuenta o cerró sesión → tiramos el cache para no mostrar datos ajenos.
      usuarioRef.current = uid;
      queryClient.clear();
    }
  }, [session, cargando]);

  useEffect(() => {
    if (cargando) return;
    const enAuth = segments[0] === '(auth)';
    if (!session && !enAuth) {
      // Sin sesión y fuera de auth → a login.
      router.replace('/login');
    } else if (session && enAuth) {
      // Con sesión y todavía en auth → a la app (Hoy).
      router.replace('/');
    }
  }, [session, cargando, segments, router]);

  if (cargando) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="perfil" options={{ presentation: 'modal' }} />
      <Stack.Screen name="mi-dragon" options={{ presentation: 'modal' }} />
      <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
      <Stack.Screen name="categorias" />
      <Stack.Screen name="comentarios" />
      <Stack.Screen name="agenda" />
      <Stack.Screen name="objetivo/[id]" />
      <Stack.Screen name="objetivo/info/[id]" />
      <Stack.Screen name="cronometros" />
      <Stack.Screen name="cronometro/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tarea/[id]" />
      <Stack.Screen name="tarea/info/[id]" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: UNA_SEMANA }}>
        <SafeAreaProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <SessionProvider>
              <DragonThemeProvider>
                <CronometroProvider>
                  <RootNavigator />
                </CronometroProvider>
              </DragonThemeProvider>
            </SessionProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
