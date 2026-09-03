import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import { Stack, useRouter, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../../src/api/learner';
import { web } from '../../src/api/web';
import { authService, authStore } from '../../src/auth/authRuntime';
import { getPublicEnvironment } from '../../src/config/env';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { describeError, useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

function Section({ icon, title, action, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons color="#1E4F8C" name={icon} size={18} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * Everything about the person, reached from the top-right avatar: profile & stats,
 * badges, career paths, certificates (shareable), department, settings (password), sign-out.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { user, tenantSlug, signOut } = useStore(authStore);
  const me = useAsync(() => learnerApi.me(), [user?.id]);
  const stats = useAsync(() => web.myStats().catch(() => null), [user?.id]);
  const paths = useAsync(() => web.myPaths().catch(() => []), [user?.id]);
  const profile = me.data?.user ?? user;
  const name = `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || t('account.title');

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  async function changePassword() {
    setBusy(true);
    setPasswordMessage(null);
    try {
      await web.changePassword(currentPassword, newPassword);
      setPasswordMessage(t('account.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setShowPassword(false);
    } catch (caught) {
      setPasswordMessage(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function shareCertificate(id: string, certNumber: string) {
    setSharing(id);
    try {
      const token = await authService.getAccessToken();
      const response = await fetch(`${getPublicEnvironment().apiUrl}/api/certificates/${id}/download`, {
        headers: { authorization: `Bearer ${token ?? ''}`, ...(tenantSlug ? { 'x-lernvo-tenant': tenantSlug } : {}) },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const file = new File(Paths.cache, `${certNumber}.svg`);
      file.write(await response.text());
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'image/svg+xml', dialogTitle: certNumber });
    } catch {
      // Sharing is best-effort; the certificate stays listed.
    } finally {
      setSharing(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('account.title') }} />
      <ScreenScaffold
        eyebrow={tenantSlug ?? t('account.title')}
        title={name}
        onRefresh={() => Promise.all([me.reload(), stats.reload(), paths.reload()])}
      >
        <StatusCopy loading={me.loading} error={me.error} onRetry={() => void me.reload()} />

        <Section icon="person-outline" title={t('account.profile')}>
          <Text style={styles.line}>{profile?.email}</Text>
          {me.data ? (
            <Text style={styles.stats}>
              {t('me.stats', { points: me.data.user.totalPoints, streak: me.data.user.currentStreak, completed: me.data.progress.completed })}
            </Text>
          ) : null}
          {stats.data ? <Text style={styles.muted}>{t('account.rank', { rank: stats.data.rank, days: stats.data.longestStreak })}</Text> : null}
        </Section>

        <Section icon="ribbon-outline" title={t('account.badges')}>
          {stats.data && stats.data.badges.length === 0 ? <Text style={styles.muted}>{t('account.noBadges')}</Text> : null}
          <View style={styles.badges}>
            {stats.data?.badges.map((ub) => (
              <View key={ub.id} style={styles.badge}>
                <Text style={styles.badgeIcon}>{ub.badge.icon}</Text>
                <Text style={styles.badgeName} numberOfLines={2}>{ub.badge.name}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section icon="git-branch-outline" title={t('account.careerPaths')}>
          {paths.data && paths.data.length === 0 ? <Text style={styles.muted}>{t('account.noPaths')}</Text> : null}
          {paths.data?.map((enr) => (
            <Pressable key={enr.id} accessibilityRole="button" onPress={() => router.push(`/career/${enr.pathId}` as Href)} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{enr.path.title}</Text>
                <Text style={styles.muted}>{Math.round(enr.progressPct)}% · {t('learn.moduleCount', { count: enr.path._count.modules })}</Text>
              </View>
              <Ionicons color="#9BA8BB" name="chevron-forward" size={18} />
            </Pressable>
          ))}
        </Section>

        <Section icon="school-outline" title={t('account.certificates')}>
          {me.data && me.data.certificates.length === 0 ? <Text style={styles.muted}>{t('me.noCertificates')}</Text> : null}
          {me.data?.certificates.map((cert) => (
            <View key={cert.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{cert.title}</Text>
                <Text style={styles.muted}>{cert.certNumber} · {formatDate(cert.issuedAt)}</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={sharing === cert.id} onPress={() => void shareCertificate(cert.id, cert.certNumber)} style={styles.shareBtn}>
                {sharing === cert.id ? <ActivityIndicator color="#163A6B" /> : <Ionicons color="#163A6B" name="share-outline" size={18} />}
                <Text style={styles.shareText}>{t('account.share')}</Text>
              </Pressable>
            </View>
          ))}
        </Section>

        <Section
          icon="business-outline"
          title={t('account.department')}
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push('/departments' as Href)}>
              <Text style={styles.link}>{t('account.openDepartments')}</Text>
            </Pressable>
          }
        >
          <Text style={styles.line}>{me.data?.user.department?.name ?? '—'}</Text>
          <Text style={styles.muted}>{profile?.role}</Text>
        </Section>

        <Section
          icon="settings-outline"
          title={t('account.settings')}
          action={
            <Pressable accessibilityRole="button" onPress={() => setShowPassword((v) => !v)}>
              <Text style={styles.link}>{t('account.changePassword')}</Text>
            </Pressable>
          }
        >
          <Text style={styles.muted}>{t('me.language')}</Text>
          {showPassword ? (
            <View style={styles.form}>
              <TextInput
                accessibilityLabel={t('account.currentPassword')}
                autoComplete="current-password"
                onChangeText={setCurrentPassword}
                placeholder={t('account.currentPassword')}
                placeholderTextColor="#9BA8BB"
                secureTextEntry
                style={styles.input}
                value={currentPassword}
              />
              <TextInput
                accessibilityLabel={t('account.newPassword')}
                autoComplete="new-password"
                onChangeText={setNewPassword}
                placeholder={t('account.newPassword')}
                placeholderTextColor="#9BA8BB"
                secureTextEntry
                style={styles.input}
                value={newPassword}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy || newPassword.length < 10 || !currentPassword}
                onPress={() => void changePassword()}
                style={[styles.primary, (busy || newPassword.length < 10 || !currentPassword) && styles.primaryDisabled]}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{t('account.changePassword')}</Text>}
              </Pressable>
            </View>
          ) : null}
          {passwordMessage ? <Text style={styles.message}>{passwordMessage}</Text> : null}
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
  section: { backgroundColor: '#FFFFFF', borderRadius: 24, marginTop: 16, padding: 18, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8 },
  sectionTitle: { color: '#163A6B', fontSize: 14, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  link: { color: '#1E4F8C', fontSize: 13, fontWeight: '700' },
  line: { color: '#1A202C', fontSize: 16 },
  stats: { color: '#1E4F8C', fontSize: 14, fontWeight: '700', marginTop: 8 },
  muted: { color: '#6B7A8D', fontSize: 14, marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  badge: { alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 16, padding: 10, width: 92 },
  badgeIcon: { fontSize: 26 },
  badgeName: { color: '#2D3748', fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  item: { alignItems: 'center', borderTopColor: '#F0F2F5', borderTopWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 10 },
  itemTitle: { color: '#1A202C', fontSize: 16, fontWeight: '700' },
  shareBtn: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 12, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  shareText: { color: '#163A6B', fontSize: 13, fontWeight: '700' },
  form: { gap: 10, marginTop: 12 },
  input: { backgroundColor: '#F7F8FA', borderColor: '#E4E8EF', borderRadius: 12, borderWidth: 1, color: '#1A202C', fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  primary: { alignItems: 'center', backgroundColor: '#1E4F8C', borderRadius: 14, justifyContent: 'center', minHeight: 48 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  message: { color: '#163A6B', fontSize: 14, fontWeight: '600', marginTop: 10 },
  signOut: { alignItems: 'center', borderColor: '#E06666', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  signOutText: { color: '#B42318', fontSize: 16, fontWeight: '700' },
});
