import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useStore } from 'zustand';

import { authStore } from '../../src/auth/authRuntime';
import { t } from '../../src/i18n';
import { learnerTabs, type LearnerTabKey } from '../../src/navigation/capabilities';

const icons: Record<LearnerTabKey, readonly [string, string]> = {
  today: ['home', 'home-outline'],
  learn: ['library', 'library-outline'],
  ask: ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  inbox: ['notifications', 'notifications-outline'],
  me: ['person-circle', 'person-circle-outline'],
};

export default function TabLayout() {
  const status = useStore(authStore, (state) => state.status);
  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1E4F8C',
        tabBarInactiveTintColor: '#8A97A8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { borderTopColor: '#E4E8EF' },
        tabBarIcon: ({ color, focused, size }) => {
          const names = icons[route.name as LearnerTabKey];
          return (
            <Ionicons
              color={color}
              name={(focused ? names[0] : names[1]) as keyof typeof Ionicons.glyphMap}
              size={size}
            />
          );
        },
      })}
    >
      {learnerTabs.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.key}
          options={{
            title: t(tab.labelKey),
            tabBarAccessibilityLabel: t('tabs.a11y', { tab: t(tab.labelKey) }),
          }}
        />
      ))}
    </Tabs>
  );
}
