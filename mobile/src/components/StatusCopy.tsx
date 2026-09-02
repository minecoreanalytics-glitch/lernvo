import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { t } from '../i18n';

export function StatusCopy({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (loading) return <ActivityIndicator color="#1E4F8C" style={styles.spinner} />;
  if (!error) return null;
  return (
    <>
      <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  spinner: { marginTop: 24 },
  error: { color: '#B42318', fontSize: 15, lineHeight: 22, marginTop: 18 },
  retry: { alignSelf: 'flex-start', marginTop: 12 },
  retryText: { color: '#1E4F8C', fontSize: 16, fontWeight: '700' },
});
