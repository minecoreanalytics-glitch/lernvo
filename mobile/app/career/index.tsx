import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { web } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

/** All career paths published for the company, with the person's enrolment state (web /career). */
export default function CareerPathsScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => web.paths(), []);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  async function enroll(id: string) {
    setEnrolling(id);
    try {
      await web.enrollPath(id);
      await reload();
    } finally {
      setEnrolling(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('career.all') }} />
      <ScreenScaffold eyebrow={t('career.allEyebrow')} title={t('career.all')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data && data.length === 0 ? <Text style={styles.copy}>{t('career.empty')}</Text> : null}
        {data?.map((path) => {
          const enrolled = path.userEnrollment;
          return (
            <Pressable key={path.id} accessibilityRole="button" onPress={() => router.push(`/career/${path.id}` as Href)} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.icon}>
                  <Ionicons color="#FFFFFF" name="git-branch" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{path.title}</Text>
                  <Text style={styles.meta}>
                    {t('career.modules', { count: path._count.modules })}
                    {path.estimatedWeeks ? ` · ${t('career.weeks', { count: path.estimatedWeeks })}` : ''}
                    {path.targetRole ? ` · ${path.targetRole}` : ''}
                  </Text>
                </View>
              </View>
              {path.description ? <Text style={styles.body} numberOfLines={3}>{path.description}</Text> : null}
              {enrolled ? (
                <>
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(3, Math.min(100, enrolled.progressPct))}%` }]} /></View>
                  <Text style={styles.enrolled}>{t('career.enrolled', { pct: Math.round(enrolled.progressPct) })}</Text>
                </>
              ) : (
                <Pressable accessibilityRole="button" disabled={enrolling === path.id} onPress={() => void enroll(path.id)} style={styles.enrollBtn}>
                  {enrolling === path.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.enrollText}>{t('career.enrollShort')}</Text>}
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, marginTop: 14, padding: 18, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  icon: { alignItems: 'center', backgroundColor: '#7C5CFC', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  title: { color: '#0F1923', fontSize: 18, fontWeight: '800' },
  meta: { color: '#6B7A8D', fontSize: 13, marginTop: 3 },
  body: { color: '#4A5568', fontSize: 15, lineHeight: 22, marginTop: 12 },
  track: { backgroundColor: '#EEF2F7', borderRadius: 999, height: 6, marginTop: 14, overflow: 'hidden' },
  fill: { backgroundColor: '#7C5CFC', borderRadius: 999, height: 6 },
  enrolled: { color: '#5B3FD9', fontSize: 13, fontWeight: '800', marginTop: 8 },
  enrollBtn: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#163A6B', borderRadius: 14, justifyContent: 'center', marginTop: 14, minHeight: 42, paddingHorizontal: 18 },
  enrollText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
