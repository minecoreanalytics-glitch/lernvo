import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';
import type { MessageKey } from '../../src/i18n/messages';

function statusLabel(status: string) {
  const key = `learn.status.${status}` as MessageKey;
  const label = t(key);
  return label === key ? status.replace('_', ' ') : label;
}

export default function LearnScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => learnerApi.learn(), []);

  return (
    <ScreenScaffold eyebrow={t('learn.eyebrow')} title={t('learn.title')}>
      <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
      {data && data.modules.length === 0 && data.paths.length === 0 ? (
        <Text style={styles.copy}>{t('learn.empty')}</Text>
      ) : null}
      {data?.modules.map((module) => (
        <Pressable
          key={module.id}
          accessibilityRole="button"
          onPress={() => router.push(`/module/${module.id}` as Href)}
          style={styles.card}
        >
          <Text style={styles.kicker}>{statusLabel(module.status)} · {module.progressPct}%</Text>
          <Text style={styles.cardTitle}>{module.title}</Text>
          {module.description ? <Text style={styles.cardBody} numberOfLines={3}>{module.description}</Text> : null}
        </Pressable>
      ))}
      {data?.paths.map((path) => (
        <View key={path.id} style={styles.card}>
          <Text style={styles.kicker}>{t('learn.path')} · {path.progressPct}%</Text>
          <Text style={styles.cardTitle}>{path.title}</Text>
          <Text style={styles.cardBody}>{t('learn.moduleCount', { count: path.moduleCount })}</Text>
        </View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 16, padding: 18 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#1A202C', fontSize: 20, fontWeight: '800', marginTop: 6 },
  cardBody: { color: '#5C6B7E', fontSize: 15, lineHeight: 22, marginTop: 8 },
});
