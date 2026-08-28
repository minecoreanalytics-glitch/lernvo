import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { authStore } from '../src/auth/authRuntime';
import { initializeSyncRuntime, syncNow } from '../src/sync/syncRuntime';

export default function RootLayout() {
  useEffect(() => {
    void authStore.getState().initialize().then(() => {
      if (authStore.getState().status === 'authenticated') void initializeSyncRuntime().then(() => syncNow());
    });
    return authStore.subscribe((state, previous) => {
      if (state.status === 'authenticated' && previous.status !== 'authenticated') {
        void initializeSyncRuntime().then(() => syncNow());
      }
    });
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
