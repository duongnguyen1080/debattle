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
  // Elapsed seconds shown in the UI; derived from startedAt via a simple tick.
  // Avoid relying on interval closures capturing stale state.
  const [elapsed, setElapsed] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ total: number; feedback: string } | null>(null);

  console.log('[RoundV2Flow] render', {
    step,
    hasUser: !!currentUser,
    selectedTheme: selectedTheme?.id,
    riddleId,
    startedAt,
    elapsed,
  });

  // Keep a steady heartbeat to force re-render and derive elapsed from startedAt.
  useInterval(() => {
    const now = Date.now();
    if (startedAt && step === 'answer') {
      const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
      setElapsed(secs);
    }
  }, 1000);

  const handleThemeSelect = async (theme: Theme) => {
    console.log('[RoundV2Flow] handleThemeSelect: start', { theme: theme.id });
    setSelectedTheme(theme);
    // Optimistic navigation to answer step to avoid UI stall
    const tStart = Date.now();
    setStartedAt(tStart);
    setElapsed(0);
    setRiddleText('⏳ Generating riddle…');
    setStep('answer');
    console.log('[RoundV2Flow] handleThemeSelect: switched to answer optimistically', { startedAt: tStart });

    try {
      console.log('[RoundV2Flow] handleThemeSelect: creating service');
      const service = new Service(context.redis, context.reddit);
      const username = currentUser?.username || 'anonymous';
      console.log('[RoundV2Flow] handleThemeSelect: calling createRiddleFromTheme', { username });
      const t0 = Date.now();
      const riddle = await service.createRiddleFromTheme({ theme: theme.id, playerUsername: username });
      console.log('[RoundV2Flow] handleThemeSelect: riddle created', { id: riddle.id, ms: Date.now() - t0 });
      setRiddleId(riddle.id);
      setRiddleText(riddle.meta.riddleText);
    } catch (e) {
      console.error('[RoundV2Flow] handleThemeSelect: error', e);
      // Fallback text if service fails entirely
      setRiddleText(`On the theme of ${theme.name}: What do you owe to yourself that cannot be owned?`);
    }
  };

  const handleSubmitAnswer = async () => {
    // Compute latest elapsed defensively from startedAt to avoid any stale state.
    const now = Date.now();
    const computedElapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : elapsed;
    console.log('[RoundV2Flow] handleSubmitAnswer: start', { riddleId, hasAnswer: !!answerText.trim(), elapsed: computedElapsed });
    if (!riddleId || !answerText.trim()) return;
    try {
      setIsSubmitting(true);
      const service = new Service(context.redis, context.reddit);
      const username = currentUser?.username || 'anonymous';
      console.log('[RoundV2Flow] handleSubmitAnswer: submitting');
      const resp = await service.submitAnswer({ riddleId, username, answerText: answerText.trim(), elapsedMs: computedElapsed * 1000 });
      console.log('[RoundV2Flow] handleSubmitAnswer: submitted', { total: resp.total });
      setResult({ total: resp.total, feedback: resp.feedback });
      setStep('result');
    } catch (e) {
      console.error('[RoundV2Flow] handleSubmitAnswer: error', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'theme') {
    console.log('[RoundV2Flow] rendering theme step');
    return (
      <EditorPageWordStep
        themes={themes}
        onThemeSelect={handleThemeSelect}
        onRefresh={() => setThemes(getRandomThemes(3))}
      />
    );
  }

  if (step === 'answer') {
    console.log('[RoundV2Flow] rendering answer step', { elapsed, startedAt });
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
        <text size="xlarge">🧩 Your Riddle</text>
        <text size="large">Theme: {selectedTheme?.name ?? ''}</text>
        <vstack gap="small" width="100%" maxWidth="560px" padding="medium">
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
  console.log('[RoundV2Flow] rendering result step', { result });
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
