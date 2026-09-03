import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { web } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

export default function CareerPathScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => web.careerPath(String(id)), [id]);
  const [enrolling, setEnrolling] = useState(false);
  const done = data?.modules.filter((m) => m.userStatus?.status === 'COMPLETED').length ?? 0;

  async function enroll() {
    if (!id) return;
    setEnrolling(true);
    try {
      await web.enrollPath(String(id));
      await reload();
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('career.title') }} />
      <ScreenScaffold eyebrow={t('career.eyebrow')} title={data?.title ?? t('career.title')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data ? (
          <>
            {data.description ? <Text style={styles.copy}>{data.description}</Text> : null}
            {data.prerequisites.length > 0 ? (
              <Text style={styles.prereq}>{t('career.prereq', { list: data.prerequisites.map((p) => p.prerequisite.title).join(', ') })}</Text>
            ) : null}

            <View style={styles.hero}>
              <View style={styles.heroBlob} />
              <Text style={styles.heroKicker}>{t('career.modules', { count: data.modules.length })} · {done}/{data.modules.length}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${data.modules.length ? Math.max(3, (done / data.modules.length) * 100) : 0}%` }]} />
              </View>
              {data.userEnrollment ? (
                <Text style={styles.heroBody}>{t('career.enrolled', { pct: Math.round(data.userEnrollment.progressPct) })}</Text>
              ) : (
                <Pressable accessibilityRole="button" disabled={enrolling} onPress={() => void enroll()} style={styles.cta}>
                  <Text style={styles.ctaText}>{t('career.enroll')}</Text>
                  <Ionicons color="#163A6B" name="arrow-forward" size={18} />
                </Pressable>
              )}
            </View>

            {data.modules.map((pm, index) => {
              const status = pm.userStatus?.status;
              const completed = status === 'COMPLETED';
              return (
                <Pressable key={pm.id} accessibilityRole="button" onPress={() => router.push(`/module/${pm.moduleId}` as Href)} style={styles.step}>
                  <View style={[styles.stepIndex, completed && styles.stepDone]}>
                    {completed ? <Ionicons color="#FFFFFF" name="checkmark" size={16} /> : <Text style={styles.stepIndexText}>{index + 1}</Text>}
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{pm.module.title}</Text>
                    <Text style={styles.stepMeta}>
                      {pm.isRequired ? t('career.required') : t('career.optional')} · {t('common.minutes', { count: pm.module.estimatedMinutes })}
                      {pm.userStatus ? ` · ${Math.round(pm.userStatus.progressPct)}%` : ''}
                    </Text>
                  </View>
                  <Ionicons color="#9BA8BB" name="chevron-forward" size={20} />
                </Pressable>
              );
            })}
          </>
        ) : null}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#4A5568', fontSize: 16, lineHeight: 24, marginTop: 14 },
  prereq: { color: '#B45309', fontSize: 14, fontWeight: '600', marginTop: 10 },
  hero: { backgroundColor: '#163A6B', borderRadius: 28, marginTop: 20, overflow: 'hidden', padding: 22, shadowColor: '#0F2849', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  heroBlob: { backgroundColor: '#F5B700', borderRadius: 999, height: 180, opacity: 0.16, position: 'absolute', right: -60, top: -80, width: 180 },
  heroKicker: { color: '#CDE5FA', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  track: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, height: 8, marginTop: 14, overflow: 'hidden' },
  fill: { backgroundColor: '#F5B700', borderRadius: 999, height: 8 },
  heroBody: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 12 },
  cta: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, minHeight: 50, paddingHorizontal: 18 },
  ctaText: { color: '#163A6B', fontSize: 16, fontWeight: '800' },
  step: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 12, padding: 14, shadowColor: '#0F2849', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  stepIndex: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  stepDone: { backgroundColor: '#0D8F8A' },
  stepIndexText: { color: '#163A6B', fontSize: 14, fontWeight: '800' },
  stepText: { flex: 1 },
  stepTitle: { color: '#0F1923', fontSize: 16, fontWeight: '700' },
  stepMeta: { color: '#6B7A8D', fontSize: 13, marginTop: 3 },
});
