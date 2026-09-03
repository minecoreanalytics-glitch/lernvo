import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { web } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { Segmented } from '../../src/components/Segmented';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

type Segment = 'notifications' | 'announcements';

const typeIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  badge: 'ribbon',
  reminder: 'alarm',
  coaching: 'chatbubbles',
  deadline: 'time',
  quiz: 'checkmark-circle',
  certificate: 'school',
};

/** Behind the bell: personal notifications (reminders, results, badges) and company announcements. */
export default function InboxScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('notifications');
  const notifications = useAsync(() => web.notifications(), []);
  const announcements = useAsync(() => learnerApi.inbox(), []);
  const active = segment === 'notifications' ? notifications : announcements;
  const unreadNotifications = notifications.data?.filter((n) => !n.isRead).length ?? 0;

  async function openNotification(id: string, link: string | null, isRead: boolean) {
    if (!isRead) await web.markNotificationRead(id).catch(() => undefined);
    await notifications.reload();
    if (link) {
      const target = link.replace(/^\/modules\//, '/module/').replace(/^\/kb\?slug=/, '/kb/');
      if (target.startsWith('/module/') || target.startsWith('/quiz/') || target.startsWith('/kb/')) router.push(target as Href);
    }
  }

  async function acknowledge(id: string) {
    await learnerApi.acknowledge([id]);
    await announcements.reload();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('notif.title') }} />
      <ScreenScaffold
        eyebrow={t('inbox.eyebrow')}
        title={t('notif.title')}
        onRefresh={() => Promise.all([notifications.reload(), announcements.reload()])}
      >
        <Segmented
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'notifications', label: t('notif.segmentNotifications'), badge: unreadNotifications },
            { value: 'announcements', label: t('notif.segmentAnnouncements'), badge: announcements.data?.unreadCount ?? 0 },
          ]}
        />
        <StatusCopy loading={active.loading} error={active.error} onRetry={() => void active.reload()} />

        {segment === 'notifications' ? (
          <>
            {notifications.data && notifications.data.length === 0 ? <Text style={styles.copy}>{t('notif.empty')}</Text> : null}
            {unreadNotifications > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => void web.markAllNotificationsRead().then(() => notifications.reload())} style={styles.markAll}>
                <Text style={styles.markAllText}>{t('notif.markAll')}</Text>
              </Pressable>
            ) : null}
            {notifications.data?.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => void openNotification(item.id, item.link, item.isRead)}
                style={[styles.card, !item.isRead && styles.cardUnread]}
              >
                <View style={[styles.iconWrap, !item.isRead && styles.iconWrapUnread]}>
                  <Ionicons color={item.isRead ? '#6B7A8D' : '#163A6B'} name={typeIcon[item.type] ?? 'notifications'} size={20} />
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.title, !item.isRead && styles.titleUnread]}>{item.title}</Text>
                  <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
                  <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
                </View>
                {!item.isRead ? <View style={styles.dot} /> : null}
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {announcements.data && announcements.data.announcements.length === 0 ? <Text style={styles.copy}>{t('inbox.empty')}</Text> : null}
            {announcements.data?.announcements.map((item) => (
              <View key={item.id} style={[styles.card, item.isUnread && styles.cardUnread]}>
                <View style={styles.cardText}>
                  <Text style={styles.meta}>
                    {item.company.name} · {item.author.firstName} {item.author.lastName} · {formatDate(item.createdAt)}
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
              </View>
            ))}
          </>
        )}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  markAll: { alignSelf: 'flex-end', marginTop: 14 },
  markAllText: { color: '#1E4F8C', fontSize: 14, fontWeight: '700' },
  card: { alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 22, flexDirection: 'row', gap: 12, marginTop: 12, padding: 16, shadowColor: '#0F2849', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardUnread: { borderColor: 'rgba(30,79,140,0.25)', borderWidth: 1 },
  iconWrap: { alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  iconWrapUnread: { backgroundColor: '#EEF4FB' },
  cardText: { flex: 1 },
  title: { color: '#2D3748', fontSize: 16, fontWeight: '700' },
  titleUnread: { color: '#0F1923' },
  body: { color: '#4A5568', fontSize: 15, lineHeight: 22, marginTop: 4 },
  meta: { color: '#8A97A8', fontSize: 12, fontWeight: '600', marginTop: 6 },
  dot: { backgroundColor: '#1E4F8C', borderRadius: 999, height: 10, marginTop: 6, width: 10 },
  ack: { alignSelf: 'flex-start', marginTop: 12 },
  ackText: { color: '#1E4F8C', fontSize: 15, fontWeight: '700' },
  read: { color: '#8A97A8', fontSize: 13, marginTop: 10 },
});
