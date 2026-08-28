import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { canAccessTeam } from '../../src/navigation/capabilities';

export default function TodayScreen() {
  const router = useRouter();
  const user = useStore(authStore, (state) => state.user);
  const firstName = user?.firstName ?? 'there';

  return (
    <ScreenScaffold eyebrow="Your daily focus" title={`Good day, ${firstName}`}>
      <View style={styles.sessionCard}>
        <Text style={styles.minutes}>5 minutes</Text>
        <Text style={styles.cardTitle}>Keep your knowledge sharp</Text>
        <Text style={styles.cardBody}>A short personalized session will appear here as your learning plan synchronizes.</Text>
        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryText}>Start today’s session</Text>
        </Pressable>
      </View>
      {user && canAccessTeam(user.role) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/team')} style={styles.teamButton}>
          <Text style={styles.teamText}>Open Team workspace</Text>
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sessionCard: { backgroundColor: '#123B2A', borderRadius: 24, marginTop: 28, padding: 24 },
  minutes: { color: '#A9E8C6', fontSize: 14, fontWeight: '700' },
  cardTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 8 },
  cardBody: { color: '#D7E9DF', fontSize: 16, lineHeight: 23, marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: '#E6FFEF', borderRadius: 14, marginTop: 24, minHeight: 50, justifyContent: 'center' },
  primaryText: { color: '#123B2A', fontSize: 16, fontWeight: '800' },
  teamButton: { alignItems: 'center', borderColor: '#97B5A5', borderRadius: 14, borderWidth: 1, marginTop: 18, minHeight: 50, justifyContent: 'center' },
  teamText: { color: '#123B2A', fontSize: 16, fontWeight: '700' },
});
