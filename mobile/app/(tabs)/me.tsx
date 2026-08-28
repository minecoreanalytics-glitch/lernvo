import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';

export default function MeScreen() {
  const { user, tenantSlug, signOut } = useStore(authStore);
  return (
    <ScreenScaffold eyebrow={tenantSlug ?? 'Profile'} title={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Me'}>
      <View style={styles.card}><Text style={styles.email}>{user?.email}</Text><Text style={styles.role}>{user?.role}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
    </ScreenScaffold>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 24, padding: 20 },
  email: { color: '#183D2D', fontSize: 17 },
  role: { color: '#61776B', fontSize: 13, fontWeight: '700', marginTop: 8 },
  signOut: { alignItems: 'center', borderColor: '#C75B5B', borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 20, minHeight: 50 },
  signOutText: { color: '#9A2424', fontSize: 16, fontWeight: '700' },
});
