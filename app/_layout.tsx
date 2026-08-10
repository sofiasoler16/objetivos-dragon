import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/components/session-provider';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { session, cargando } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Ocultamos el splash recién cuando sabemos si hay sesión o no.
    if (!cargando) SplashScreen.hideAsync();
  }, [cargando]);

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
      <Stack.Screen name="categorias" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <SessionProvider>
              <RootNavigator />
            </SessionProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
