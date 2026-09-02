import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ScreenScaffold({
  title,
  eyebrow,
  children,
  scroll = true,
  footer,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  scroll?: boolean;
  footer?: ReactNode;
}>) {
  const body = (
    <View style={styles.content}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : body}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F7F8FA', flex: 1 },
  scroll: { paddingBottom: 32 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24 },
  eyebrow: { color: '#1E4F8C', fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#1A202C', fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginTop: 5 },
});
