import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../../src/api/learner';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

export default function MeScreen() {
  const { user, tenantSlug, signOut } = useStore(authStore);
  const { data, error, loading, reload } = useAsync(() => learnerApi.me(), [user?.id]);
  const profile = data?.user ?? user;

  return (
    <ScreenScaffold eyebrow={tenantSlug ?? t('me.eyebrow')} title={`${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || t('me.title')} onRefresh={reload}>
      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
      <View style={styles.card}>
        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.role}>{data?.user.department?.name ?? profile?.role}</Text>
        {data ? (
          <Text style={styles.stats}>
            {t('me.stats', { points: data.user.totalPoints, streak: data.user.currentStreak, completed: data.progress.completed })}
          </Text>
        ) : null}
      </View>
      {data?.certificates.map((cert) => (
        <View key={cert.id} style={styles.card}>
          <Text style={styles.kicker}>{t('me.certificate')}</Text>
          <Text style={styles.certTitle}>{cert.title}</Text>
          <Text style={styles.meta}>{cert.certNumber} · {formatDate(cert.issuedAt)}</Text>
        </View>
      ))}
      {data && data.certificates.length === 0 ? (
        <Text style={styles.empty}>{t('me.noCertificates')}</Text>
      ) : null}
      <Text style={styles.hint}>{t('me.language')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.signOutText}>{t('me.signOut')}</Text>
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 24, padding: 20 },
  email: { color: '#2D3748', fontSize: 17 },
  role: { color: '#8A97A8', fontSize: 13, fontWeight: '700', marginTop: 8 },
  stats: { color: '#1E4F8C', fontSize: 14, fontWeight: '700', marginTop: 12 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  certTitle: { color: '#1A202C', fontSize: 18, fontWeight: '800', marginTop: 6 },
  meta: { color: '#8A97A8', fontSize: 13, marginTop: 6 },
  empty: { color: '#5C6B7E', fontSize: 15, marginTop: 18 },
  hint: { color: '#8A97A8', fontSize: 13, marginTop: 24 },
  signOut: { alignItems: 'center', borderColor: '#E06666', borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 12, minHeight: 50 },
  signOutText: { color: '#B42318', fontSize: 16, fontWeight: '700' },
});
