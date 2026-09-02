import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

export default function DocsScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => learnerApi.kb(), []);

  return (
    <ScreenScaffold eyebrow={t('docs.eyebrow')} title={t('docs.title')}>
      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
      {data && data.articles.length === 0 ? (
        <Text style={styles.copy}>{t('docs.empty')}</Text>
      ) : null}
      {data?.articles.map((article) => (
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
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 16, padding: 18 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#1A202C', fontSize: 19, fontWeight: '800', marginTop: 6 },
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
