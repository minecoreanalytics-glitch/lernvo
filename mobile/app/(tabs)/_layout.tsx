import { Redirect, Tabs } from 'expo-router';
import { useStore } from 'zustand';

import { authStore } from '../../src/auth/authRuntime';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { t } from '../../src/i18n';
import { learnerTabs } from '../../src/navigation/capabilities';

export default function TabLayout() {
  const status = useStore(authStore, (state) => state.status);
  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#F4F6FA' } }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      {learnerTabs.map((tab) => (
        <Tabs.Screen key={tab.key} name={tab.key} options={{ title: t(tab.labelKey) }} />
      ))}
    </Tabs>
  );
}
