import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../api/learner';
import { authStore } from '../auth/authRuntime';
import { useAsync } from '../hooks/useAsync';
import { t } from '../i18n';

const glass = isLiquidGlassAvailable();

/** Liquid Glass pill on iOS 26+, a soft frosted chip elsewhere. */
function Chip({ children, style, tint = 'rgba(255,255,255,0.55)' }: PropsWithChildren<{ style?: ViewStyle; tint?: string }>) {
  if (glass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive tintColor={tint} style={[styles.chip, style]}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.chip, styles.chipFallback, style]}>{children}</View>;
}

/**
 * Top-right account bar shown on every tab: announcements bell (with unread
 * badge) and the avatar that opens the account screen. Profile and settings
 * live top-right, never in the tab bar.
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
      >
        <Chip>
          <Ionicons color="#163A6B" name={unread > 0 ? 'notifications' : 'notifications-outline'} size={22} />
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Chip>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('account.a11y')} hitSlop={8} onPress={() => router.push('/account')}>
        <Chip style={styles.avatar} tint="rgba(22,58,107,0.85)">
          <Text style={styles.avatarText}>{initials}</Text>
        </Chip>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  chip: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  chipFallback: { backgroundColor: 'rgba(255,255,255,0.78)', borderColor: 'rgba(22,58,107,0.10)', borderWidth: 1 },
  avatar: { backgroundColor: 'rgba(22,58,107,0.92)' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  badge: {
    alignItems: 'center',
    backgroundColor: '#E5484D',
    borderRadius: 999,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
