import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useStore } from 'zustand';

import { authStore } from '../../src/auth/authRuntime';

const icons = {
  today: ['sparkles', 'sparkles-outline'],
  learn: ['library', 'library-outline'],
  ask: ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  inbox: ['notifications', 'notifications-outline'],
  me: ['person-circle', 'person-circle-outline'],
} as const;

export default function TabLayout() {
  const status = useStore(authStore, (state) => state.status);
  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#146B45',
        tabBarInactiveTintColor: '#61776B',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { borderTopColor: '#DCE6E0' },
        tabBarIcon: ({ color, focused, size }) => {
          const names = icons[route.name as keyof typeof icons];
          return <Ionicons color={color} name={focused ? names[0] : names[1]} size={size} />;
        },
      })}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarAccessibilityLabel: 'Today tab' }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarAccessibilityLabel: 'Learn tab' }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask', tabBarAccessibilityLabel: 'Ask tab' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarAccessibilityLabel: 'Inbox tab' }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarAccessibilityLabel: 'Me tab' }} />
    </Tabs>
  );
}
