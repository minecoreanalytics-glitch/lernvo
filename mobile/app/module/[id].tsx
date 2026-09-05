import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { web } from '../../src/api/web';
import { getPublicEnvironment } from '../../src/config/env';
import { Markdown } from '../../src/components/Markdown';
import { MediaSection } from '../../src/components/MediaSection';
import { SlideDeck } from '../../src/components/SlideDeck';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { describeError, useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';
import { hasSlideMarkers } from '../../src/slides/parseSlides';

/** Content URLs are stored relative (/uploads/...) or absolute. Protected uploads need the media token. */
function authorize(url: string, token: string | null) {
  const absolute = /^https?:\/\//i.test(url) ? url : `${getPublicEnvironment().apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  if (!token || !absolute.startsWith(`${getPublicEnvironment().apiUrl.replace(/\/$/, '')}/uploads/`)) return absolute;
  return `${absolute}${absolute.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}

export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => (id ? learnerApi.module(id) : Promise.resolve(null)), [id]);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function start() {
    if (!id) return;
    setStarting(true);
    setActionError(null);
    try {
      await learnerApi.startModule(id);
      await reload();
    } catch (caught) {
      setActionError(describeError(caught));
    } finally {
      setStarting(false);
    }
  }
  const media = useAsync(() => web.mediaToken().then((r) => r.token).catch(() => null), []);

  async function completeContent(contentId: string) {
    setActionError(null);
    try {
      await learnerApi.markContent(contentId, 100);
      await reload();
    } catch (caught) {
      setActionError(describeError(caught));
    }
  }

  const total = data?.contents.length ?? 0;
  const done = data?.contents.filter((c) => c.progress?.completed).length ?? 0;
  const enrolled = Boolean(data?.enrollment) && data?.enrollment?.status !== 'NOT_STARTED';
  const requiredLeft = data?.contents.filter((c) => c.isRequired && !c.progress?.completed).length ?? 0;
  const quizUnlocked = enrolled && requiredLeft === 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: data?.category?.name ?? t('module.title') }} />
      <ScreenScaffold eyebrow={data?.category?.name ?? t('module.title')} title={data?.title ?? t('module.title')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        <StatusCopy error={actionError} />
        {data ? (
          <View style={styles.summary}>
            <View style={styles.summaryBlob} />
            <Text style={styles.summaryKicker}>{t('common.minutes', { count: data.estimatedMinutes })} · {done}/{total}</Text>
            {data.description ? <Text style={styles.summaryBody}>{data.description}</Text> : null}
            <View style={styles.track}><View style={[styles.fill, { width: `${total ? Math.max(3, (done / total) * 100) : 0}%` }]} /></View>
            {!enrolled ? (
              <Pressable accessibilityRole="button" disabled={starting} onPress={() => void start()} style={styles.startBtn}>
                {starting ? <ActivityIndicator color="#163A6B" /> : <Text style={styles.startText}>{t('today.start')}</Text>}
                <Ionicons color="#163A6B" name="arrow-forward" size={18} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {data && !data.prerequisiteMet && data.prerequisite ? (
          <Text style={styles.warn}>{t('module.prerequisite', { title: data.prerequisite.title })}</Text>
        ) : null}
        {data?.contents.map((content, index) => (
          <View key={content.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.step, content.progress?.completed && styles.stepDone]}>
                {content.progress?.completed ? <Ionicons color="#FFFFFF" name="checkmark" size={14} /> : <Text style={styles.stepText}>{index + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>{content.type}{content.duration ? ` · ${t('common.minutes', { count: Math.round(content.duration / 60) || 1 })}` : ''}</Text>
                <Text style={styles.cardTitle}>{content.title}</Text>
              </View>
            </View>
            {content.body && (content.type === 'PRESENTATION' || hasSlideMarkers(content.body)) ? (
              <SlideDeck body={content.body} completed={Boolean(content.progress?.completed)} onComplete={enrolled ? () => void completeContent(content.id) : undefined} />
            ) : content.body ? (
              <Markdown body={content.body} />
            ) : null}
            {content.url ? (
              <MediaSection
                type={content.type}
                url={content.url}
                authorizedUrl={authorize(content.url, media.data ?? null)}
                onCompleted={() => { if (enrolled) void completeContent(content.id); }}
              />
            ) : null}
            {enrolled && !content.progress?.completed && !(content.body && (content.type === 'PRESENTATION' || hasSlideMarkers(content.body))) ? (
              <Pressable accessibilityRole="button" onPress={() => void completeContent(content.id)} style={styles.secondary}>
                <Ionicons color="#1E4F8C" name="checkmark-circle-outline" size={18} />
                <Text style={styles.secondaryText}>{t('module.markDone')}</Text>
              </Pressable>
            ) : content.progress?.completed ? (
              <Text style={styles.doneText}>{t('module.done')}</Text>
            ) : null}
          </View>
        ))}
        {data?.quizzes.map((quiz) => (
          <View key={quiz.id} style={styles.quizCard}>
            <View style={styles.cardHead}>
              <View style={styles.quizIcon}>
                <Ionicons color="#163A6B" name="help-circle" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>{t('quiz.title')} · {t('quiz.passing', { score: quiz.passingScore })}</Text>
                <Text style={styles.cardTitle}>{quiz.title.replace(/^quiz\s*:\s*/i, '')}</Text>
              </View>
            </View>
            {quizUnlocked ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/quiz/${quiz.id}` as Href)} style={styles.primary}>
                <Text style={styles.primaryText}>{t('quiz.start')}</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
              </Pressable>
            ) : (
              <View style={[styles.primary, styles.primaryLocked]}>
                <Text style={styles.primaryLockedText}>{enrolled ? t('quiz.locked', { count: requiredLeft }) : t('quiz.lockedStart')}</Text>
                <Ionicons color="#8A97A8" name="lock-closed" size={18} />
              </View>
            )}
          </View>
        ))}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: '#163A6B', borderRadius: 26, marginTop: 18, overflow: 'hidden', padding: 20, shadowColor: '#0F2849', shadowOpacity: 0.25, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  summaryBlob: { backgroundColor: '#F5B700', borderRadius: 999, height: 160, opacity: 0.16, position: 'absolute', right: -50, top: -70, width: 160 },
  summaryKicker: { color: '#CDE5FA', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  summaryBody: { color: '#E4E8EF', fontSize: 15, lineHeight: 22, marginTop: 8 },
  track: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, height: 8, marginTop: 14, overflow: 'hidden' },
  fill: { backgroundColor: '#F5B700', borderRadius: 999, height: 8 },
  warn: { color: '#B42318', fontSize: 15, marginTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, marginTop: 14, padding: 18, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  step: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 999, height: 30, justifyContent: 'center', width: 30 },
  stepDone: { backgroundColor: '#0D8F8A' },
  stepText: { color: '#163A6B', fontSize: 13, fontWeight: '800' },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#0F1923', fontSize: 18, fontWeight: '800', marginTop: 2 },
  body: { color: '#2D3748', fontSize: 16, lineHeight: 24, marginTop: 12 },
  secondary: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 14 },
  secondaryText: { color: '#1E4F8C', fontSize: 15, fontWeight: '700' },
  doneText: { color: '#0D8F8A', fontSize: 13, fontWeight: '800', marginTop: 12, textTransform: 'uppercase' },
  quizCard: { backgroundColor: '#FFFFFF', borderRadius: 24, marginTop: 18, padding: 18, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  quizIcon: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  primary: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#1E4F8C', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, minHeight: 50, paddingHorizontal: 18 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  primaryLocked: { backgroundColor: '#EEF2F7' },
  primaryLockedText: { color: '#6B7A8D', flex: 1, fontSize: 14, fontWeight: '700' },
  startBtn: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, minHeight: 50, paddingHorizontal: 18 },
  startText: { color: '#163A6B', fontSize: 16, fontWeight: '800' },
});
