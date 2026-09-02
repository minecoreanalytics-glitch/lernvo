import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';
import type { MessageKey } from '../../src/i18n/messages';

type Segment = 'modules' | 'docs';

function statusLabel(status: string) {
  const key = `learn.status.${status}` as MessageKey;
  const label = t(key);
  return label === key ? status.replace('_', ' ') : label;
}

export default function LearnScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('modules');
  const catalog = useAsync(() => learnerApi.learn(), []);
  const docs = useAsync(() => learnerApi.kb(), []);
  const active = segment === 'modules' ? catalog : docs;

  return (
    <ScreenScaffold
      eyebrow={t('learn.eyebrow')}
      title={t('learn.title')}
      onRefresh={() => Promise.all([catalog.reload(), docs.reload()])}
    >
      <View accessibilityRole="tablist" style={styles.segments}>
        {(['modules', 'docs'] as const).map((key) => {
          const selected = segment === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setSegment(key)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {t(key === 'modules' ? 'learn.segmentModules' : 'learn.segmentDocs')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <StatusCopy loading={active.loading} error={active.error} onRetry={() => void active.reload()} />

      {segment === 'modules' ? (
        <>
          {catalog.data && catalog.data.modules.length === 0 && catalog.data.paths.length === 0 ? (
            <Text style={styles.copy}>{t('learn.empty')}</Text>
          ) : null}
          {catalog.data?.modules.map((module) => (
            <Pressable
              key={module.id}
              accessibilityRole="button"
              onPress={() => router.push(`/module/${module.id}` as Href)}
              style={styles.card}
            >
              <Text style={styles.kicker}>{statusLabel(module.status)} · {module.progressPct}%</Text>
              <Text style={styles.cardTitle}>{module.title}</Text>
              {module.description ? <Text style={styles.cardBody} numberOfLines={3}>{module.description}</Text> : null}
            </Pressable>
          ))}
          {catalog.data?.paths.map((path) => (
            <View key={path.id} style={styles.card}>
              <Text style={styles.kicker}>{t('learn.path')} · {path.progressPct}%</Text>
              <Text style={styles.cardTitle}>{path.title}</Text>
              <Text style={styles.cardBody}>{t('learn.moduleCount', { count: path.moduleCount })}</Text>
            </View>
          ))}
        </>
      ) : (
        <>
          {docs.data && docs.data.articles.length === 0 ? (
            <Text style={styles.copy}>{t('docs.empty')}</Text>
          ) : null}
          {docs.data?.articles.map((article) => (
            <Pressable
              key={article.id}
              accessibilityRole="button"
              onPress={() => router.push(`/kb/${article.id}` as Href)}
              style={styles.card}
            >
              {article.category ? <Text style={styles.kicker}>{article.category}</Text> : null}
              <Text style={styles.cardTitle}>{article.title}</Text>
              {article.tags.length > 0 ? (
                <View style={styles.tags}>
                  {article.tags.slice(0, 3).map((tag) => (
                    <Text key={tag} style={styles.tag}>{tag}</Text>
                  ))}
                </View>
              ) : null}
            </Pressable>
          ))}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  segments: { backgroundColor: '#E4E8EF', borderRadius: 12, flexDirection: 'row', marginTop: 18, padding: 3 },
  segment: { alignItems: 'center', borderRadius: 10, flex: 1, minHeight: 40, justifyContent: 'center' },
  segmentSelected: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#5C6B7E', fontSize: 15, fontWeight: '600' },
  segmentTextSelected: { color: '#163A6B', fontWeight: '800' },
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 16, padding: 18 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#1A202C', fontSize: 20, fontWeight: '800', marginTop: 6 },
  cardBody: { color: '#5C6B7E', fontSize: 15, lineHeight: 22, marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    backgroundColor: '#EEF4FB',
    borderRadius: 999,
    color: '#1E4F8C',
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
