import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { web } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

/** Badge catalogue with the person's earned state (web profile "Badges"). */
export default function BadgesScreen() {
  const catalogue = useAsync(() => web.badges(), []);
  const stats = useAsync(() => web.myStats(), []);
  const earned = new Map((stats.data?.badges ?? []).map((ub) => [ub.badge.id, ub.earnedAt]));
  const total = catalogue.data?.length ?? 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('badges.title') }} />
      <ScreenScaffold eyebrow={t('badges.eyebrow')} title={t('badges.title')} onRefresh={() => Promise.all([catalogue.reload(), stats.reload()])}>
        <StatusCopy loading={catalogue.loading} error={catalogue.error ?? stats.error} onRetry={() => void Promise.all([catalogue.reload(), stats.reload()])} />
        {catalogue.data && total === 0 ? <Text style={styles.copy}>{t('badges.empty')}</Text> : null}
        {catalogue.data && total > 0 ? (
          <View style={styles.hero}>
            <View style={styles.heroBlob} />
            <Text style={styles.heroKicker}>{t('badges.progress', { earned: earned.size, total })}</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${total ? Math.max(3, (earned.size / total) * 100) : 0}%` }]} /></View>
            {stats.data ? <Text style={styles.heroBody}>{stats.data.totalPoints} pts · 🔥 {stats.data.currentStreak}</Text> : null}
          </View>
        ) : null}
        <View style={styles.grid}>
          {catalogue.data?.map((badge) => {
            const when = earned.get(badge.id);
            return (
              <View key={badge.id} style={[styles.card, !when && styles.cardLocked]}>
                <View style={[styles.iconWrap, !when && styles.iconLocked]}>
                  <Text style={[styles.icon, !when && styles.iconMuted]}>{badge.icon}</Text>
                </View>
                <Text style={styles.name} numberOfLines={2}>{badge.name}</Text>
                <Text style={styles.desc} numberOfLines={3}>{badge.description}</Text>
                <Text style={[styles.state, when ? styles.stateEarned : styles.stateLocked]}>
                  {when ? t('badges.earned', { date: formatDate(when) }) : t('badges.locked')} · {t('badges.points', { points: badge.points })}
                </Text>
              </View>
            );
          })}
        </View>
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  hero: { backgroundColor: '#163A6B', borderRadius: 26, marginTop: 18, overflow: 'hidden', padding: 20, shadowColor: '#0F2849', shadowOpacity: 0.25, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  heroBlob: { backgroundColor: '#F5B700', borderRadius: 999, height: 160, opacity: 0.16, position: 'absolute', right: -50, top: -70, width: 160 },
  heroKicker: { color: '#CDE5FA', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  track: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, height: 8, marginTop: 12, overflow: 'hidden' },
  fill: { backgroundColor: '#F5B700', borderRadius: 999, height: 8 },
  heroBody: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, flexBasis: '47%', flexGrow: 1, padding: 14, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardLocked: { opacity: 0.75 },
  iconWrap: { alignItems: 'center', backgroundColor: '#FFF3D6', borderRadius: 16, height: 52, justifyContent: 'center', width: 52 },
  iconLocked: { backgroundColor: '#F0F2F5' },
  icon: { fontSize: 26 },
  iconMuted: { opacity: 0.45 },
  name: { color: '#0F1923', fontSize: 15, fontWeight: '800', marginTop: 10 },
  desc: { color: '#6B7A8D', fontSize: 12, lineHeight: 17, marginTop: 4 },
  state: { fontSize: 11, fontWeight: '800', marginTop: 10, textTransform: 'uppercase' },
  stateEarned: { color: '#0D8F8A' },
  stateLocked: { color: '#9BA8BB' },
});
