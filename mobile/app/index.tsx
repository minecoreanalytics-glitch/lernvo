import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { authStore } from '../src/auth/authRuntime';

export default function StartScreen() {
  const status = useStore(authStore, (state) => state.status);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'authenticated') return <Redirect href="/(tabs)/today" />;

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#1E4F8C" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
