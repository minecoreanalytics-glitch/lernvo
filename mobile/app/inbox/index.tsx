import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

export default function InboxScreen() {
  const { data, error, loading, reload } = useAsync(() => learnerApi.inbox(), []);

  async function acknowledge(id: string) {
    await learnerApi.acknowledge([id]);
    await reload();
  }

  return (
    <>
    <Stack.Screen options={{ headerShown: true, title: t('inbox.title') }} />
    <ScreenScaffold eyebrow={t('inbox.eyebrow')} title={t('inbox.title')} onRefresh={reload}>
      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
      {data && data.announcements.length === 0 ? (
        <Text style={styles.copy}>{t('inbox.empty')}</Text>
      ) : null}
      {data && data.unreadCount > 0 ? (
        <Text style={styles.unread}>{t('inbox.unreadCount', { count: data.unreadCount })}</Text>
      ) : null}
      {data?.announcements.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.meta}>
            {item.company.name} · {item.author.firstName} {item.author.lastName} · {formatDate(item.createdAt)}
            {item.isUnread ? ` · ${t('inbox.unread')}` : ''}
          </Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          {item.isUnread ? (
            <Pressable accessibilityRole="button" onPress={() => void acknowledge(item.id)} style={styles.ack}>
              <Text style={styles.ackText}>{t('inbox.acknowledge')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.read}>{t('inbox.acknowledged')}</Text>
          )}
        </View>
      ))}
    </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  unread: { color: '#1E4F8C', fontSize: 14, fontWeight: '700', marginTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 14, padding: 18 },
  meta: { color: '#8A97A8', fontSize: 13, fontWeight: '700' },
  body: { color: '#1A202C', fontSize: 16, lineHeight: 23, marginTop: 8 },
  ack: { alignSelf: 'flex-start', marginTop: 12 },
  ackText: { color: '#1E4F8C', fontSize: 15, fontWeight: '700' },
  read: { color: '#8A97A8', fontSize: 13, marginTop: 10 },
});
