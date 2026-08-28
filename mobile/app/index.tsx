import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { authStore } from '../src/auth/authRuntime';

export default function StartScreen() {
  const status = useStore(authStore, (state) => state.status);

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <View style={styles.container}>
      {status === 'checking' ? <ActivityIndicator color="#146B45" /> : (
        <>
          <Text accessibilityRole="header" style={styles.title}>Lernvo</Text>
          <Text style={styles.subtitle}>Your daily learning starts here.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F4F7F5',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#123B2A',
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    color: '#385747',
    fontSize: 17,
    marginTop: 8,
  },
});
