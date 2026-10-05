import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebracionDragon } from '@/components/CelebracionDragon';
import { Onboarding } from '@/components/Onboarding';
import { AvisoAsignacion } from '@/components/AvisoAsignacion';
import { PromoPremium } from '@/components/PromoPremium';
import { RecordatoriosSync } from '@/components/RecordatoriosSync';
import { SyncPendientes } from '@/components/SyncPendientes';
import { useTheme } from '@/components/theme-provider';

export default function TabsLayout() {
  const colors = useTheme();
  // Alto de la barrita de navegación del sistema (0 si el teléfono no la tiene).
  const insets = useSafeAreaInsets();
  return (
    <>
      <RecordatoriosSync />
      <AvisoAsignacion />
      <SyncPendientes />
      <Onboarding />
      <PromoPremium />
      <CelebracionDragon />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#9891ab',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.divider,
          // Sumamos el alto de la barrita del sistema para que los íconos no queden tapados.
          height: 80 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
        tabBarActiveBackgroundColor: colors.purple,
        tabBarItemStyle: { borderRadius: 18, marginHorizontal: 8, marginVertical: 6 },
      }}>
      <Tabs.Screen
        name="objetivos"
        options={{
          title: 'Objetivos',
          tabBarIcon: ({ color, size }) => <Ionicons name="disc-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="grupos"
        options={{
          title: 'Grupos',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      </Tabs>
    </>
  );
}
