import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

/** Strip the most common inline markdown so raw body reads cleanly as text. */
function inline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/^#+\s*/, '');
}

function Body({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  return (
    <View style={styles.body}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line.trim() === '') return <View key={i} style={styles.spacer} />;
        if (/^#{1,2}\s/.test(line)) {
          return (
            <Text key={i} accessibilityRole="header" style={styles.h2}>
              {inline(line)}
            </Text>
          );
        }
        if (/^#{3,}\s/.test(line)) {
          return (
            <Text key={i} accessibilityRole="header" style={styles.h3}>
              {inline(line)}
            </Text>
          );
        }
        if (/^\s*(?:[-*]|\d+[.)])\s+/.test(line)) {
          const numbered = line.match(/^\s*(\d+)[.)]\s+/);
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>{numbered ? `${numbered[1]}.` : '•'}</Text>
              <Text style={styles.bulletText}>{inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''))}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.paragraph}>
            {inline(line)}
          </Text>
        );
      })}
    </View>
  );
}

export default function KbArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(() => learnerApi.kbArticle(String(id)), [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: data?.category ?? t('docs.document') }} />
      <ScreenScaffold eyebrow={data?.category ?? t('docs.document')} title={data?.title ?? t('docs.document')}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data ? (
          <Fragment>
            <Text style={styles.meta}>{t('docs.updated', { date: formatDate(data.updatedAt) })}</Text>
            <Body body={data.body} />
          </Fragment>
        ) : null}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: '#5C6B7E', fontSize: 13, fontWeight: '600', marginTop: 6 },
  body: { marginTop: 18 },
  spacer: { height: 12 },
  h2: { color: '#1A202C', fontSize: 20, fontWeight: '800', marginTop: 18, marginBottom: 4 },
  h3: { color: '#163A6B', fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 2 },
  paragraph: { color: '#1A202C', fontSize: 16, lineHeight: 24, marginTop: 8 },
  bulletRow: { flexDirection: 'row', marginTop: 8, paddingRight: 8 },
  bulletDot: { color: '#1E4F8C', fontSize: 16, lineHeight: 24, marginRight: 8, minWidth: 18 },
  bulletText: { color: '#1A202C', flex: 1, fontSize: 16, lineHeight: 24 },
});
