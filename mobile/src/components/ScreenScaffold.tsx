import type { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function ScreenScaffold({
  title,
  eyebrow,
  children,
}: PropsWithChildren<{ title: string; eyebrow?: string }>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F4F7F5', flex: 1 },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 24 },
  eyebrow: { color: '#146B45', fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#10281D', fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginTop: 5 },
});
