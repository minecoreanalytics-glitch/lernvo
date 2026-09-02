import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { learnerApi, type QuizSubmitResult } from '../../src/api/learner';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { describeError, useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(() => (id ? learnerApi.quiz(id) : Promise.resolve(null)), [id]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const questionCount = data?.questions.length ?? 0;
  const selectedCount = useMemo(() => Object.keys(answers).length, [answers]);

  async function submit() {
    if (!id || !data) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = data.questions.flatMap((question) => {
        const selected = answers[question.id];
        return selected ? [{ questionId: question.id, selectedOptionId: selected }] : [];
      });
      setResult(await learnerApi.submitQuiz(id, payload));
    } catch (caught) {
      setSubmitError(caught instanceof Error ? describeError(caught) : t('quiz.submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  const resultByQuestion = new Map(result?.answers.map((answer) => [answer.questionId, answer]) ?? []);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: data?.title ?? t('quiz.title') }} />
      <ScreenScaffold eyebrow={t('quiz.eyebrow')} title={data?.title ?? t('quiz.title')}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data && !data.canAttempt && !result ? (
          <Text style={styles.copy}>{t('quiz.alreadyPassed')}</Text>
        ) : null}
        {data?.questions.map((question, index) => {
          const outcome = resultByQuestion.get(question.id);
          return (
            <View key={question.id} style={styles.card}>
              <Text style={styles.kicker}>{t('quiz.question', { n: index + 1 })}</Text>
              <Text style={styles.prompt}>{question.text}</Text>
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={Boolean(result) || !data.canAttempt}
                    onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text>
                  </Pressable>
                );
              })}
              {outcome ? (
                <Text style={outcome.isCorrect ? styles.ok : styles.bad}>
                  {outcome.isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
                  {outcome.explanation ? ` · ${outcome.explanation}` : ''}
                </Text>
              ) : null}
            </View>
          );
        })}
        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>{result.passed ? t('quiz.passed') : t('quiz.notPassed')}</Text>
            <Text style={styles.resultCopy}>{t('quiz.score', { score: Math.round(result.score), points: result.pointsEarned })}</Text>
          </View>
        ) : data?.canAttempt ? (
          <Pressable
            accessibilityRole="button"
            disabled={submitting || selectedCount !== questionCount}
            onPress={() => void submit()}
            style={[styles.primary, (submitting || selectedCount !== questionCount) && styles.primaryDisabled]}
          >
            <Text style={styles.primaryText}>{submitting ? t('quiz.submitting') : t('quiz.submit')}</Text>
          </Pressable>
        ) : null}
        {submitError ? <Text accessibilityRole="alert" style={styles.bad}>{submitError}</Text> : null}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 16, padding: 18 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  prompt: { color: '#1A202C', fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  option: { borderColor: '#E4E8EF', borderRadius: 12, borderWidth: 1, marginTop: 8, minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#163A6B', borderColor: '#163A6B' },
  optionText: { color: '#2D3748', fontSize: 16 },
  optionTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  ok: { color: '#0D8F8A', fontSize: 14, fontWeight: '700', marginTop: 12 },
  bad: { color: '#B42318', fontSize: 14, fontWeight: '700', marginTop: 12 },
  result: { backgroundColor: '#163A6B', borderRadius: 18, marginTop: 18, padding: 20 },
  resultTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  resultCopy: { color: '#E4E8EF', fontSize: 16, marginTop: 6 },
  primary: { alignItems: 'center', backgroundColor: '#1E4F8C', borderRadius: 14, justifyContent: 'center', marginTop: 18, minHeight: 50 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
