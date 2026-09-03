import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { web, type AssignmentEnrollment } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

function Group({ title, tone, items, onOpen }: { title: string; tone: 'danger' | 'warn' | 'neutral'; items: AssignmentEnrollment[]; onOpen: (item: AssignmentEnrollment) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View style={[styles.pill, tone === 'danger' && styles.pillDanger, tone === 'warn' && styles.pillWarn]}>
          <Text style={[styles.pillText, tone !== 'neutral' && styles.pillTextStrong]}>{title}</Text>
        </View>
        <Text style={styles.count}>{items.length}</Text>
      </View>
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={() => onOpen(item)} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.kicker}>{item.module.category?.name ?? t('module.title')} · {t('common.minutes', { count: item.module.estimatedMinutes })}</Text>
            <Text style={styles.title}>{item.module.title}</Text>
            <View style={styles.metaRow}>
              {item.dueAt ? <Text style={styles.meta}>{t('assign.due', { date: formatDate(item.dueAt) })}</Text> : null}
              {item.hasPendingQuiz ? <Text style={styles.quiz}>{t('assign.quizPending')}</Text> : null}
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(3, Math.min(100, item.progressPct))}%` }]} />
            </View>
          </View>
          <Ionicons color="#9BA8BB" name="chevron-forward" size={20} />
        </Pressable>
      ))}
    </View>
  );
}

/** "Devoirs": every enrollment with a deadline, grouped like the web assignments page. */
export default function AssignmentsScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => web.assignments(), []);
  const total = data ? data.overdue.length + data.today.length + data.upcoming.length + data.noDueDate.length : 0;
  const open = (item: AssignmentEnrollment) => router.push(`/module/${item.moduleId}` as Href);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('assign.title') }} />
      <ScreenScaffold eyebrow={t('assign.eyebrow')} title={t('assign.title')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data && total === 0 ? <Text style={styles.copy}>{t('assign.empty')}</Text> : null}
        {data ? (
          <>
            <Group title={t('assign.overdue')} tone="danger" items={data.overdue} onOpen={open} />
            <Group title={t('assign.today')} tone="warn" items={data.today} onOpen={open} />
            <Group title={t('assign.upcoming')} tone="neutral" items={data.upcoming} onOpen={open} />
            <Group title={t('assign.noDue')} tone="neutral" items={data.noDueDate} onOpen={open} />
          </>
        ) : null}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  group: { marginTop: 22 },
  groupHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pill: { backgroundColor: '#E4E8EF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillDanger: { backgroundColor: '#FDE8E8' },
  pillWarn: { backgroundColor: '#FFF3D6' },
  pillText: { color: '#2D3748', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  pillTextStrong: { color: '#0E1116' },
  count: { color: '#8A97A8', fontSize: 14, fontWeight: '800' },
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, flexDirection: 'row', gap: 10, marginTop: 12, padding: 16, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardText: { flex: 1 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#0F1923', fontSize: 17, fontWeight: '800', marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  meta: { color: '#6B7A8D', fontSize: 13, fontWeight: '600' },
  quiz: { color: '#B45309', fontSize: 13, fontWeight: '700' },
  track: { backgroundColor: '#EEF2F7', borderRadius: 999, height: 6, marginTop: 12, overflow: 'hidden' },
  fill: { backgroundColor: '#1E4F8C', borderRadius: 999, height: 6 },
});
