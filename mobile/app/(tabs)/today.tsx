import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../../src/api/learner';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';
import { canAccessTeam } from '../../src/navigation/capabilities';
import { syncNow, syncStatusLabel, syncStatusSource } from '../../src/sync/syncRuntime';
import { useSyncStatus } from '../../src/sync/useSyncStatus';

export default function TodayScreen() {
  const router = useRouter();
  const user = useStore(authStore, (state) => state.user);
  const syncStatus = useSyncStatus(syncStatusSource);
  const { data, error, loading, reload } = useAsync(() => learnerApi.today(), [user?.id]);
  const session = data?.session;
  const firstName = user?.firstName ?? t('today.fallbackName');

  const reasonLabel = session && session.kind !== 'none'
    ? t(`today.reason.${session.reason}`)
    : null;

  async function startSession() {
    if (!session || session.kind === 'none') return;
    await learnerApi.startModule(session.moduleId).catch(() => undefined);
    if (session.kind === 'quiz' && session.quizId) {
      router.push(`/quiz/${session.quizId}` as Href);
      return;
    }
    router.push(`/module/${session.moduleId}` as Href);
  }

  return (
    <ScreenScaffold eyebrow={t('today.eyebrow')} title={t('today.greeting', { name: firstName })} onRefresh={reload}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sync.a11y')} onPress={() => void syncNow()} style={styles.syncPill}>
        <Text style={styles.syncText}>{syncStatusLabel(syncStatus)}</Text>
      </Pressable>
      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
      {session?.kind === 'none' ? (
        <View style={styles.sessionCard}>
          <Text style={styles.minutes}>{t('today.caughtUp')}</Text>
          <Text style={styles.cardTitle}>{t('today.noSessionTitle')}</Text>
          <Text style={styles.cardBody}>{t('today.noSessionBody')}</Text>
        </View>
      ) : session ? (
        <View style={styles.sessionCard}>
          <Text style={styles.minutes}>{t('common.minutes', { count: session.estimatedMinutes })} · {reasonLabel}</Text>
          <Text style={styles.cardTitle}>{session.title}</Text>
          <Text style={styles.cardBody}>
            {session.kind === 'quiz' ? t('today.quizBody') : t('today.moduleBody')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void startSession()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{t('today.start')}</Text>
          </Pressable>
        </View>
      ) : null}
      {user && canAccessTeam(user.role) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/team')} style={styles.teamButton}>
          <Text style={styles.teamText}>{t('today.openTeam')}</Text>
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sessionCard: { backgroundColor: '#163A6B', borderRadius: 24, marginTop: 28, padding: 24 },
  minutes: { color: '#CDE5FA', fontSize: 14, fontWeight: '700' },
  cardTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 8 },
  cardBody: { color: '#E4E8EF', fontSize: 16, lineHeight: 23, marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 14, marginTop: 24, minHeight: 50, justifyContent: 'center' },
  primaryText: { color: '#163A6B', fontSize: 16, fontWeight: '800' },
  teamButton: { alignItems: 'center', borderColor: '#9BA8BB', borderRadius: 14, borderWidth: 1, marginTop: 18, minHeight: 50, justifyContent: 'center' },
  teamText: { color: '#163A6B', fontSize: 16, fontWeight: '700' },
  syncPill: { alignSelf: 'flex-start', backgroundColor: '#E4E8EF', borderRadius: 999, marginTop: 16, paddingHorizontal: 12, paddingVertical: 7 },
  syncText: { color: '#2D3748', fontSize: 13, fontWeight: '700' },
});
