import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { MobileApiError } from '../../src/api/errors';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { describeError } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

type ChatTurn = { role: 'user' | 'assistant'; content: string; citations?: Array<{ id: string; title: string }> };

export default function AskScreen() {
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    const history = turns.map(({ role, content }) => ({ role, content })).slice(-10);
    setMessage('');
    setError(null);
    setTurns((current) => [...current, { role: 'user', content: trimmed }]);
    setBusy(true);
    try {
      const result = await learnerApi.ask(trimmed, history);
      setTurns((current) => [
        ...current,
        { role: 'assistant', content: result.reply, citations: result.citations },
      ]);
    } catch (caught) {
      setError(caught instanceof MobileApiError ? describeError(caught) : t('ask.unreachable'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenScaffold accountBar eyebrow={t('ask.eyebrow')} title={t('ask.title')}>
      <Text style={styles.copy}>{t('ask.copy')}</Text>
      {turns.map((turn, index) => (
        <View key={`${turn.role}-${index}`} style={[styles.bubble, turn.role === 'user' ? styles.user : styles.assistant]}>
          <Text style={turn.role === 'user' ? styles.userText : styles.assistantText}>{turn.content}</Text>
          {turn.citations && turn.citations.length > 0 ? (
            <Text style={styles.citations}>{t('ask.sources', { list: turn.citations.map((item) => item.title).join(', ') })}</Text>
          ) : null}
        </View>
      ))}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <TextInput
        accessibilityLabel={t('ask.question')}
        editable={!busy}
        multiline
        onChangeText={setMessage}
        placeholder={t('ask.placeholder')}
        placeholderTextColor="#9BA8BB"
        style={styles.input}
        value={message}
      />
      <Pressable accessibilityRole="button" disabled={busy || !message.trim()} onPress={() => void send()} style={styles.button}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('ask.send')}</Text>}
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  bubble: { borderRadius: 16, marginTop: 14, padding: 14 },
  user: { alignSelf: 'flex-end', backgroundColor: '#163A6B', maxWidth: '92%' },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', maxWidth: '92%' },
  userText: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  assistantText: { color: '#1A202C', fontSize: 16, lineHeight: 22 },
  citations: { color: '#8A97A8', fontSize: 13, marginTop: 8 },
  error: { color: '#B42318', fontSize: 14, marginTop: 14 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E8EF', borderRadius: 12, borderWidth: 1, color: '#1A202C', fontSize: 16, marginTop: 18, minHeight: 88, padding: 14, textAlignVertical: 'top' },
  button: { alignItems: 'center', backgroundColor: '#1E4F8C', borderRadius: 14, justifyContent: 'center', marginTop: 12, minHeight: 50 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
