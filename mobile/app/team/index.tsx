import { Redirect, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useStore } from 'zustand';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { canAccessTeam } from '../../src/navigation/capabilities';

export default function TeamScreen() {
  const user = useStore(authStore, (state) => state.user);
  if (!user || !canAccessTeam(user.role)) return <Redirect href="/(tabs)/today" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Team' }} />
      <ScreenScaffold eyebrow="Manager workspace" title="Team"><Text style={styles.copy}>Exceptions, coaching priorities, and required actions will appear here.</Text></ScreenScaffold>
    </>
  );
}
const styles = StyleSheet.create({ copy: { color: '#476354', fontSize: 17, lineHeight: 25, marginTop: 18 } });
