import { Devvit, useInterval, useState } from '@devvit/public-api';
import { Service } from '../../services/Service.js';
import { User, Theme } from '../../types/index.js';
import { getRandomThemes } from '../../utils/gameUtils.js';
import { EditorPageWordStep } from '../EditorPageWordStep.js';

interface RoundV2FlowProps {
  context: any;
  currentUser: User | null;
  onExit: () => void;
}

type Step = 'theme' | 'answer' | 'result';

export function RoundV2Flow({ context, currentUser, onExit }: RoundV2FlowProps) {
  const [step, setStep] = useState<Step>('theme');
  const [themes, setThemes] = useState<Theme[]>(getRandomThemes(3));
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [riddleId, setRiddleId] = useState<string | null>(null);
  const [riddleText, setRiddleText] = useState<string>('');
  const [answerText, setAnswerText] = useState<string>('');
  const [elapsed, setElapsed] = useState<number>(0); // count-up (seconds)
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ total: number; feedback: string } | null>(null);

  useInterval(() => {
    if (step === 'answer' && startedAt) {
      const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(secs);
    }
  }, 1000);

  const handleThemeSelect = async (theme: Theme) => {
    setSelectedTheme(theme);
    // Generate AI riddle via service (V2)
    try {
      const service = new Service(context.redis, context.reddit);
      const username = currentUser?.username || 'anonymous';
      const riddle = await service.createRiddleFromTheme({ theme: theme.id, playerUsername: username });
      setRiddleId(riddle.id);
      setRiddleText(riddle.meta.riddleText);
      setStartedAt(Date.now());
      setElapsed(0);
      setStep('answer');
    } catch (e) {
      console.error('Failed to start round:', e);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!riddleId || !answerText.trim()) return;
    try {
      setIsSubmitting(true);
      const service = new Service(context.redis, context.reddit);
      const username = currentUser?.username || 'anonymous';
      const resp = await service.submitAnswer({ riddleId, username, answerText: answerText.trim(), elapsedMs: elapsed * 1000 });
      setResult({ total: resp.total, feedback: resp.feedback });
      setStep('result');
    } catch (e) {
      console.error('Failed to submit answer:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'theme') {
    return (
      <EditorPageWordStep
        themes={themes}
        onThemeSelect={handleThemeSelect}
        onRefresh={() => setThemes(getRandomThemes(3))}
      />
    );
  }

  if (step === 'answer') {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
        <text size="xlarge">🧩 Your Riddle</text>
        <text size="large">Theme: {selectedTheme?.name ?? ''}</text>
        <vstack gap="small" width="100%" maxWidth="560px" padding="medium" backgroundColor="neutral">
          <text size="medium">{riddleText}</text>
        </vstack>

        <text size="large">⏱️ {elapsed}s</text>

        <vstack gap="small" width="100%" maxWidth="560px">
          <text size="medium" weight="bold">Your Answer</text>
          <text size="medium">{answerText || 'Tap to enter your answer...'}</text>
          <hstack gap="small">
            <button appearance="secondary" onPress={() => setAnswerText(answerText + (answerText ? ' …' : 'My answer'))}>✍️ Edit</button>
            <button appearance="secondary" onPress={() => setAnswerText('')}>🧹 Clear</button>
          </hstack>
          <text size="small" color="secondary">{answerText.length}/300 characters</text>
        </vstack>

        <hstack gap="medium" width="100%" maxWidth="560px">
          <button appearance="secondary" width="50%" onPress={onExit}>← Home</button>
          <button
            appearance="primary"
            width="50%"
            disabled={!answerText.trim() || isSubmitting}
            onPress={handleSubmitAnswer}
          >
            🚀 Submit Answer
          </button>
        </hstack>
      </vstack>
    );
  }

  // result
  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">✅ Round Complete</text>
      {result ? (
        <>
          <text size="large">Score: {result.total}/20</text>
          <text size="medium" color="secondary">Arete: “{result.feedback}”</text>
        </>
      ) : (
        <text size="medium">No result available</text>
      )}

      <hstack gap="medium" width="100%" maxWidth="560px">
        <button appearance="primary" width="100%" onPress={onExit}>🏠 Back to Home</button>
      </hstack>
    </vstack>
  );
}
