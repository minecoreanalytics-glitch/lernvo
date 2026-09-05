import { StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

const medal = ['🥇', '🥈', '🥉'];

/** "Top": the company leaderboard, same ranking as the web. */
export default function TopScreen() {
  const { data, error, loading, reload } = useAsync(() => learnerApi.leaderboard(), []);

  return (
    <ScreenScaffold accountBar eyebrow={t('top.eyebrow')} title={t('top.title')} onRefresh={reload}>
      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
      {data?.me ? (
        <View style={styles.meCard}>
          <Text style={styles.meKicker}>{t('top.you')}</Text>
          <Text style={styles.meTitle}>{data.me.rank ? t('top.rank', { rank: data.me.rank }) : '—'}</Text>
          <Text style={styles.meBody}>{t('top.points', { points: data.me.totalPoints })} · 🔥 {data.me.currentStreak}</Text>
        </View>
      ) : null}
      {data && data.entries.length === 0 ? <Text style={styles.copy}>{t('top.empty')}</Text> : null}
      {data?.entries.map((row) => (
        <View key={row.userId} style={[styles.row, row.isMe && styles.rowMe]}>
          <Text style={styles.rank}>{medal[row.rank - 1] ?? row.rank}</Text>
          <View style={styles.rowText}>
            <Text style={[styles.name, row.isMe && styles.nameMe]} numberOfLines={1}>
              {row.firstName} {row.lastName}
            </Text>
            {row.department ? <Text style={styles.dept} numberOfLines={1}>{row.department}</Text> : null}
          </View>
          <Text style={styles.points}>{t('top.points', { points: row.totalPoints })}</Text>
        </View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  meCard: { backgroundColor: '#163A6B', borderRadius: 28, shadowColor: '#0F2849', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, marginTop: 20, padding: 20 },
  meKicker: { color: '#CDE5FA', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  meTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 6 },
  meBody: { color: '#E4E8EF', fontSize: 15, marginTop: 6 },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, shadowColor: '#0F2849', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, flexDirection: 'row', gap: 12, marginTop: 10, minHeight: 56, paddingHorizontal: 14 },
  rowMe: { borderColor: '#1E4F8C', borderWidth: 2 },
  rank: { color: '#163A6B', fontSize: 18, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  rowText: { flex: 1 },
  name: { color: '#1A202C', fontSize: 16, fontWeight: '700' },
  nameMe: { color: '#163A6B' },
  dept: { color: '#8A97A8', fontSize: 12, marginTop: 2 },
  points: { color: '#1E4F8C', fontSize: 14, fontWeight: '800' },
});
