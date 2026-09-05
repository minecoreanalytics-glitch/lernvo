import { StyleSheet, Text, View } from 'react-native';

/** Strip the most common inline markdown so raw body reads cleanly as text. */
function inline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/^#+\s*/, '');
}

/** Lightweight markdown renderer: headings, paragraphs, bullet and numbered lists, quotes. */
export function Markdown({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  return (
    <View style={styles.body}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line.trim() === '') return <View key={i} style={styles.spacer} />;
        if (/^#{1,2}\s/.test(line)) {
          return <Text key={i} accessibilityRole="header" style={styles.h2}>{inline(line)}</Text>;
        }
        if (/^#{3,}\s/.test(line)) {
          return <Text key={i} accessibilityRole="header" style={styles.h3}>{inline(line)}</Text>;
        }
        if (/^>\s?/.test(line)) {
          return (
            <View key={i} style={styles.quote}>
              <Text style={styles.quoteText}>{inline(line.replace(/^>\s?/, ''))}</Text>
            </View>
          );
        }
        if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) {
          const numbered = line.match(/^\s*(\d+)[.)]\s+/);
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>{numbered ? `${numbered[1]}.` : '•'}</Text>
              <Text style={styles.bulletText}>{inline(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''))}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.paragraph}>{inline(line)}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 10 },
  spacer: { height: 10 },
  h2: { color: '#1A202C', fontSize: 20, fontWeight: '800', marginBottom: 4, marginTop: 16 },
  h3: { color: '#163A6B', fontSize: 16, fontWeight: '700', marginBottom: 2, marginTop: 12 },
  paragraph: { color: '#1A202C', fontSize: 16, lineHeight: 24, marginTop: 6 },
  quote: { backgroundColor: '#EEF4FB', borderLeftColor: '#1E4F8C', borderLeftWidth: 3, borderRadius: 8, marginTop: 8, padding: 10 },
  quoteText: { color: '#2D3748', fontSize: 15, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', marginTop: 6, paddingRight: 8 },
  bulletDot: { color: '#1E4F8C', fontSize: 16, lineHeight: 24, marginRight: 8, minWidth: 18 },
  bulletText: { color: '#1A202C', flex: 1, fontSize: 16, lineHeight: 24 },
});
