import { useLocalSearchParams, useRouter, Stack, type Href } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { getPublicEnvironment } from '../../src/config/env';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

/** Content URLs are stored relative (/uploads/...) or absolute; open them in the system browser. */
function absoluteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${getPublicEnvironment().apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(async () => {
    if (!id) return null;
    await learnerApi.startModule(id).catch(() => undefined);
    return learnerApi.module(id);
  }, [id]);

  async function completeContent(contentId: string) {
    await learnerApi.markContent(contentId, 100);
    await reload();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: data?.title ?? t('module.title') }} />
      <ScreenScaffold eyebrow={t('module.title')} title={data?.title ?? t('module.title')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data?.description ? <Text style={styles.copy}>{data.description}</Text> : null}
        {data && !data.prerequisiteMet && data.prerequisite ? (
          <Text style={styles.warn}>{t('module.prerequisite', { title: data.prerequisite.title })}</Text>
        ) : null}
        {data?.contents.map((content) => (
          <View key={content.id} style={styles.card}>
            <Text style={styles.kicker}>{content.type}{content.progress?.completed ? ` · ${t('module.done')}` : ''}</Text>
            <Text style={styles.cardTitle}>{content.title}</Text>
            {content.body ? <Text style={styles.body}>{content.body}</Text> : null}
            {content.url ? (
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(absoluteUrl(content.url!))} style={styles.secondary}>
                <Text style={styles.link} numberOfLines={1}>{content.url}</Text>
              </Pressable>
            ) : null}
            {!content.progress?.completed ? (
              <Pressable accessibilityRole="button" onPress={() => void completeContent(content.id)} style={styles.secondary}>
                <Text style={styles.secondaryText}>{t('module.markDone')}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {data?.quizzes.map((quiz) => (
          <Pressable
            key={quiz.id}
            accessibilityRole="button"
            onPress={() => router.push(`/quiz/${quiz.id}` as Href)}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{t('module.takeQuiz', { title: quiz.title })}</Text>
          </Pressable>
        ))}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  warn: { color: '#B42318', fontSize: 15, marginTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 16, padding: 18 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#1A202C', fontSize: 20, fontWeight: '800', marginTop: 6 },
  body: { color: '#2D3748', fontSize: 16, lineHeight: 24, marginTop: 10 },
  link: { color: '#1E4F8C', fontSize: 14, textDecorationLine: 'underline' },
  secondary: { alignSelf: 'flex-start', marginTop: 12 },
  secondaryText: { color: '#1E4F8C', fontSize: 15, fontWeight: '700' },
  primary: { alignItems: 'center', backgroundColor: '#1E4F8C', borderRadius: 14, justifyContent: 'center', marginTop: 18, minHeight: 50 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
