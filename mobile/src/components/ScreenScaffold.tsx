import { useCallback, useState, type PropsWithChildren, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountBar } from './AccountBar';

export function ScreenScaffold({
  title,
  eyebrow,
  children,
  scroll = true,
  footer,
  onRefresh,
  accountBar = false,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  scroll?: boolean;
  footer?: ReactNode;
  /** Pull-to-refresh handler (the platform convention users expect on any list). */
  onRefresh?: () => Promise<unknown> | void;
  /** Show the top-right bell + avatar (tab screens only). */
  accountBar?: boolean;
}>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const body = (
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        </View>
        {accountBar ? <AccountBar /> : null}
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {scroll ? (
        // contentInsetAdjustmentBehavior lets content scroll underneath the floating
        // native tab bar (Liquid Glass on iOS 26) and drives its minimize-on-scroll.
        <ScrollView
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#1E4F8C" />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : body}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F4F6FA', flex: 1 },
  scroll: { paddingBottom: 120 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerText: { flex: 1, paddingTop: 6 },
  eyebrow: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: '#0F1923', fontSize: 34, fontWeight: '800', letterSpacing: -0.9, marginTop: 4 },
});
