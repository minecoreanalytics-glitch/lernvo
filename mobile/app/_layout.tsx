import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { authStore } from '../src/auth/authRuntime';

export default function RootLayout() {
  useEffect(() => {
    void authStore.getState().initialize();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
