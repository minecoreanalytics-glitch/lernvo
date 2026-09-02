import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authStore } from '../src/auth/authRuntime';
import { refreshBootstrap } from '../src/bootstrap/session';
import { initializeSyncRuntime, syncNow } from '../src/sync/syncRuntime';

function startAuthenticatedSession() {
  void initializeSyncRuntime().then(() => syncNow());
  void refreshBootstrap().catch(() => undefined);
}

export default function RootLayout() {
  useEffect(() => {
    void authStore.getState().initialize().then(() => {
      if (authStore.getState().status === 'authenticated') startAuthenticatedSession();
    });
    return authStore.subscribe((state, previous) => {
      if (state.status === 'authenticated' && previous.status !== 'authenticated') {
        startAuthenticatedSession();
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
