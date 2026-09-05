import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../../src/api/learner';
import { web } from '../../src/api/web';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';
import { canAccessTeam } from '../../src/navigation/capabilities';
import { syncNow, syncStatusLabel, syncStatusSource } from '../../src/sync/syncRuntime';
import { useSyncStatus } from '../../src/sync/useSyncStatus';

const quickTiles = [
  { key: 'learn', href: '/(tabs)/learn', icon: 'book' as const, bg: '#1E4F8C', fg: '#FFFFFF' },
  { key: 'data', href: '/(tabs)/data', icon: 'documents' as const, bg: '#0EA5A0', fg: '#FFFFFF' },
  { key: 'ask', href: '/(tabs)/ask', icon: 'chatbubble-ellipses' as const, bg: '#F5B700', fg: '#0E1116' },
  { key: 'top', href: '/(tabs)/top', icon: 'trophy' as const, bg: '#7C5CFC', fg: '#FFFFFF' },
] as const;

export default function TodayScreen() {
  const router = useRouter();
  const user = useStore(authStore, (state) => state.user);
  const syncStatus = useSyncStatus(syncStatusSource);
  const { data, error, loading, reload } = useAsync(() => learnerApi.today(), [user?.id]);
  const assignments = useAsync(() => web.assignments().catch(() => null), [user?.id]);
  const overdueCount = assignments.data?.overdue.length ?? 0;
  const todayCount = assignments.data?.today.length ?? 0;
  const assignedTotal = assignments.data ? overdueCount + todayCount + assignments.data.upcoming.length + assignments.data.noDueDate.length : 0;
  const session = data?.session;
  const firstName = user?.firstName ?? t('today.fallbackName');
  const reasonLabel = session && session.kind !== 'none' ? t(`today.reason.${session.reason}`) : null;
  const urgent = session && session.kind !== 'none' && (session.reason === 'overdue' || session.reason === 'dueToday');

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
    <ScreenScaffold accountBar eyebrow={t('today.eyebrow')} title={t('today.greeting', { name: firstName })} onRefresh={() => Promise.all([reload(), assignments.reload()])}>
      {/* Ask entry point, search-bar shaped: the fastest path to an approved answer. */}
      <Pressable accessibilityRole="search" onPress={() => router.push('/(tabs)/ask')} style={styles.askBar}>
        <Ionicons color="#1E4F8C" name="sparkles" size={18} />
        <Text style={styles.askText}>{t('today.askPlaceholder')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('sync.a11y')} hitSlop={8} onPress={() => void syncNow()} style={styles.syncDot}>
          <Ionicons color={syncStatus === 'upToDate' ? '#0D8F8A' : '#F59E0B'} name={syncStatus === 'syncing' ? 'sync' : 'cloud-done-outline'} size={18} />
        </Pressable>
      </Pressable>
      <Text style={styles.syncLabel}>{syncStatusLabel(syncStatus)}</Text>

      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />

      {/* Priority card: layered surfaces, decorative volume, floating icon chip over the edge. */}
      {session ? (
        <View style={styles.heroWrap}>
          <View style={styles.hero}>
            <View style={styles.heroBlobLarge} />
            <View style={styles.heroBlobSmall} />
            {session.kind === 'none' ? (
              <>
                <Text style={styles.heroKicker}>{t('today.caughtUp')}</Text>
                <Text style={styles.heroTitle}>{t('today.noSessionTitle')}</Text>
                <Text style={styles.heroBody}>{t('today.noSessionBody')}</Text>
              </>
            ) : (
              <>
                <View style={styles.heroTop}>
                  <View style={[styles.ribbon, urgent && styles.ribbonUrgent]}>
                    <Text style={[styles.ribbonText, urgent && styles.ribbonTextUrgent]}>{reasonLabel}</Text>
                  </View>
                  <Text style={styles.heroMeta}>{t('common.minutes', { count: session.estimatedMinutes })}</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={3}>{session.title}</Text>
                <Text style={styles.heroBody}>{session.kind === 'quiz' ? t('today.quizBody') : t('today.moduleBody')}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, session.progressPct))}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{t('today.progress', { pct: Math.round(session.progressPct) })}</Text>
                <Pressable accessibilityRole="button" onPress={() => void startSession()} style={styles.cta}>
                  <Text style={styles.ctaText}>{t('today.start')}</Text>
                  <View style={styles.ctaArrow}>
                    <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
                  </View>
                </Pressable>
              </>
            )}
          </View>
          <View style={styles.heroChip}>
            <Ionicons color="#163A6B" name={session.kind === 'quiz' ? 'help-circle' : session.kind === 'none' ? 'checkmark-done' : 'book'} size={24} />
          </View>
        </View>
      ) : null}

      {assignedTotal > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/assignments' as Href)} style={styles.teamCard}>
          <View style={[styles.teamIcon, overdueCount > 0 && styles.teamIconAlert]}>
            <Ionicons color={overdueCount > 0 ? '#B42318' : '#163A6B'} name="calendar" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamText}>{t('assign.homeCardTitle')}</Text>
            <Text style={styles.teamSub}>{t('assign.homeCard', { overdue: overdueCount, today: todayCount })}</Text>
          </View>
          <Ionicons color="#8A97A8" name="chevron-forward" size={20} />
        </Pressable>
      ) : null}

      {/* Quick access tiles (colour blocks, reference: category tiles). */}
      <Text style={styles.sectionTitle}>{t('today.quick')}</Text>
      <View style={styles.tiles}>
        {quickTiles.map((tile) => (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            onPress={() => router.push(tile.href as Href)}
            style={({ pressed }) => [styles.tile, { backgroundColor: tile.bg }, pressed && styles.tilePressed]}
          >
            <View style={[styles.tileIcon, { backgroundColor: tile.fg === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(14,17,22,0.10)' }]}>
              <Ionicons color={tile.fg} name={tile.icon} size={22} />
            </View>
            <Text style={[styles.tileLabel, { color: tile.fg }]}>{t(`tabs.${tile.key}`)}</Text>
          </Pressable>
        ))}
      </View>

      {user && canAccessTeam(user.role) ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/team')} style={styles.teamCard}>
          <View style={styles.teamIcon}>
            <Ionicons color="#163A6B" name="people" size={22} />
          </View>
          <Text style={styles.teamText}>{t('today.openTeam')}</Text>
          <Ionicons color="#8A97A8" name="chevron-forward" size={20} />
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  askBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    minHeight: 52,
    paddingHorizontal: 16,
    shadowColor: '#0F2849',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  askText: { color: '#6B7A8D', flex: 1, fontSize: 15 },
  syncDot: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  syncLabel: { color: '#9BA8BB', fontSize: 12, fontWeight: '600', marginLeft: 6, marginTop: 8 },

  heroWrap: { marginTop: 26, paddingTop: 16 },
  hero: {
    backgroundColor: '#163A6B',
    borderRadius: 28,
    overflow: 'hidden',
    padding: 22,
    paddingTop: 34,
    shadowColor: '#0F2849',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 6,
  },
  heroBlobLarge: { backgroundColor: '#F5B700', borderRadius: 999, height: 220, opacity: 0.16, position: 'absolute', right: -70, top: -90, width: 220 },
  heroBlobSmall: { backgroundColor: '#FFFFFF', borderRadius: 999, bottom: -60, height: 160, left: -50, opacity: 0.06, position: 'absolute', width: 160 },
  heroChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    left: 22,
    position: 'absolute',
    shadowColor: '#0F2849',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    top: -12,
    width: 56,
    elevation: 8,
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  ribbon: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  ribbonUrgent: { backgroundColor: '#F5B700' },
  ribbonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  ribbonTextUrgent: { color: '#0E1116' },
  heroMeta: { color: '#CDE5FA', fontSize: 14, fontWeight: '700' },
  heroKicker: { color: '#CDE5FA', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30, marginTop: 14 },
  heroBody: { color: '#D6E5F5', fontSize: 15, lineHeight: 22, marginTop: 8 },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, height: 8, marginTop: 18, overflow: 'hidden' },
  progressFill: { backgroundColor: '#F5B700', borderRadius: 999, height: 8 },
  progressLabel: { color: '#CDE5FA', fontSize: 12, fontWeight: '700', marginTop: 8 },
  cta: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, minHeight: 52, paddingLeft: 18, paddingRight: 8 },
  ctaText: { color: '#163A6B', fontSize: 16, fontWeight: '800' },
  ctaArrow: { alignItems: 'center', backgroundColor: '#163A6B', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },

  sectionTitle: { color: '#0F1923', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 28 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  tile: {
    borderRadius: 22,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: 112,
    padding: 16,
    shadowColor: '#0F2849',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  tileIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  tileLabel: { fontSize: 16, fontWeight: '800', marginTop: 14 },

  teamCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    minHeight: 68,
    paddingHorizontal: 16,
    shadowColor: '#0F2849',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  teamIcon: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  teamText: { color: '#163A6B', flex: 1, fontSize: 16, fontWeight: '700' },
  teamSub: { color: '#6B7A8D', fontSize: 13, marginTop: 2 },
  teamIconAlert: { backgroundColor: '#FDE8E8' },
});
