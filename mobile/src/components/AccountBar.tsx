import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../api/learner';
import { authStore } from '../auth/authRuntime';
import { useAsync } from '../hooks/useAsync';
import { t } from '../i18n';

/**
 * Top-right account bar shown on every tab: announcements bell (with unread
 * badge) and the avatar that opens the account screen. Follows the convention
 * of the apps people already use: settings and profile live top-right, not in
 * the tab bar.
 */
export function AccountBar() {
  const router = useRouter();
  const user = useStore(authStore, (state) => state.user);
  const inbox = useAsync(() => learnerApi.inbox(), [user?.id]);
  const unread = inbox.data?.unreadCount ?? 0;
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '•';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `${t('inbox.a11y')} · ${t('inbox.unreadCount', { count: unread })}` : t('inbox.a11y')}
        hitSlop={8}
        onPress={() => router.push('/inbox')}
        style={styles.iconButton}
      >
        <Ionicons color="#163A6B" name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('account.a11y')}
        hitSlop={8}
        onPress={() => router.push('/account')}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 14, justifyContent: 'flex-end' },
  iconButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  badge: {
    alignItems: 'center',
    backgroundColor: '#E5484D',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 0,
    top: 0,
    height: 18,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  avatar: { alignItems: 'center', backgroundColor: '#163A6B', borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
