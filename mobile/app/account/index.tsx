import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../../src/api/learner';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

function Section({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons color="#1E4F8C" name={icon} size={18} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Everything about the person, reached from the top-right avatar: profile,
 * career paths, certificates, department, settings, sign-out.
 */
export default function AccountScreen() {
  const { user, tenantSlug, signOut } = useStore(authStore);
  const me = useAsync(() => learnerApi.me(), [user?.id]);
  const learn = useAsync(() => learnerApi.learn(), [user?.id]);
  const profile = me.data?.user ?? user;
  const name = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || t('account.title');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('account.title') }} />
      <ScreenScaffold
        eyebrow={tenantSlug ?? t('account.title')}
        title={name}
        onRefresh={() => Promise.all([me.reload(), learn.reload()])}
      >
        <StatusCopy loading={me.loading} error={me.error} onRetry={() => void me.reload()} />

        <Section icon="person-outline" title={t('account.profile')}>
          <Text style={styles.line}>{profile?.email}</Text>
          {me.data ? (
            <Text style={styles.stats}>
              {t('me.stats', { points: me.data.user.totalPoints, streak: me.data.user.currentStreak, completed: me.data.progress.completed })}
            </Text>
          ) : null}
        </Section>

        <Section icon="git-branch-outline" title={t('account.careerPaths')}>
          {learn.data && learn.data.paths.length === 0 ? <Text style={styles.muted}>{t('account.noPaths')}</Text> : null}
          {learn.data?.paths.map((path) => (
            <View key={path.id} style={styles.item}>
              <Text style={styles.itemTitle}>{path.title}</Text>
              <Text style={styles.muted}>{path.progressPct}% · {t('learn.moduleCount', { count: path.moduleCount })}</Text>
            </View>
          ))}
        </Section>

        <Section icon="ribbon-outline" title={t('account.certificates')}>
          {me.data && me.data.certificates.length === 0 ? <Text style={styles.muted}>{t('me.noCertificates')}</Text> : null}
          {me.data?.certificates.map((cert) => (
            <View key={cert.id} style={styles.item}>
              <Text style={styles.itemTitle}>{cert.title}</Text>
              <Text style={styles.muted}>{cert.certNumber} · {formatDate(cert.issuedAt)}</Text>
            </View>
          ))}
        </Section>

        <Section icon="business-outline" title={t('account.department')}>
          <Text style={styles.line}>{me.data?.user.department?.name ?? '—'}</Text>
          <Text style={styles.muted}>{profile?.role}</Text>
        </Section>

        <Section icon="settings-outline" title={t('account.settings')}>
          <Text style={styles.muted}>{t('me.language')}</Text>
        </Section>

        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}>
          <Ionicons color="#B42318" name="log-out-outline" size={18} />
          <Text style={styles.signOutText}>{t('me.signOut')}</Text>
        </Pressable>
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#FFFFFF', borderRadius: 24, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2, marginTop: 16, padding: 18 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8 },
  sectionTitle: { color: '#163A6B', fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  line: { color: '#1A202C', fontSize: 16 },
  stats: { color: '#1E4F8C', fontSize: 14, fontWeight: '700', marginTop: 8 },
  item: { borderTopColor: '#F0F2F5', borderTopWidth: 1, paddingVertical: 10 },
  itemTitle: { color: '#1A202C', fontSize: 16, fontWeight: '700' },
  muted: { color: '#6B7A8D', fontSize: 14, marginTop: 4 },
  signOut: { alignItems: 'center', borderColor: '#E06666', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 20, minHeight: 50 },
  signOutText: { color: '#B42318', fontSize: 16, fontWeight: '700' },
});
