import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Onboarding } from '@/components/Onboarding';
import { RecordatoriosSync } from '@/components/RecordatoriosSync';
import { useTheme } from '@/components/theme-provider';

export default function TabsLayout() {
  const colors = useTheme();
  return (
    <>
      <RecordatoriosSync />
      <Onboarding />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#9891ab',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.divider,
          height: 80,
          paddingTop: 8,
          paddingBottom: 8,
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
      </Tabs>
    </>
  );
}
