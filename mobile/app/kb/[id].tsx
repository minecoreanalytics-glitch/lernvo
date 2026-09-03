import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, Text } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { Markdown } from '../../src/components/Markdown';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

export default function KbArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(() => learnerApi.kbArticle(String(id)), [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: data?.category ?? t('docs.document') }} />
      <ScreenScaffold eyebrow={data?.category ?? t('docs.document')} title={data?.title ?? t('docs.document')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data ? (
          <Fragment>
            <Text style={styles.meta}>{t('docs.updated', { date: formatDate(data.updatedAt) })}</Text>
            <Markdown body={data.body} />
          </Fragment>
        ) : null}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: '#5C6B7E', fontSize: 13, fontWeight: '600', marginTop: 6 },
});
