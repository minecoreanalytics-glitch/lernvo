import { Redirect, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { learnerApi } from '../../src/api/learner';
import { authStore } from '../../src/auth/authRuntime';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';
import { canAccessTeam } from '../../src/navigation/capabilities';

export default function TeamScreen() {
  const user = useStore(authStore, (state) => state.user);
  const { data, error, loading, reload } = useAsync(() => learnerApi.team(), [user?.id]);
  if (!user || !canAccessTeam(user.role)) return <Redirect href="/(tabs)/today" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('team.title') }} />
      <ScreenScaffold eyebrow={t('team.eyebrow')} title={t('team.title')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data ? (
          <Text style={styles.copy}>{t('team.summary', { count: data.count, overdue: data.overdueMembers })}</Text>
        ) : null}
        {data?.members.map((member) => (
          <View key={member.id} style={styles.card}>
            <Text style={styles.name}>{member.firstName} {member.lastName}</Text>
            {member.department ? <Text style={styles.dept}>{member.department}</Text> : null}
            <Text style={styles.meta}>{t('team.member', { overdue: member.overdueCount, inProgress: member.inProgressCount })}</Text>
          </View>
        ))}
        {data && data.members.length === 0 ? (
          <Text style={styles.copy}>{t('team.empty')}</Text>
        ) : null}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 14, padding: 18 },
  name: { color: '#1A202C', fontSize: 18, fontWeight: '800' },
  dept: { color: '#1E4F8C', fontSize: 13, fontWeight: '700', marginTop: 4 },
  meta: { color: '#8A97A8', fontSize: 14, marginTop: 6 },
});
