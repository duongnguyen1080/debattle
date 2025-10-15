import { Devvit, useInterval, useState, useAsync, useForm } from '@devvit/public-api';
import { Service } from '../../services/Service.js';
import { User, Theme } from '../../types/index.js';
import { getRandomThemes } from '../../utils/gameUtils.js';

const FALLBACK_RIDDLE_TEXT = 'Consider this: What do you owe to yourself that cannot be owned?';

interface RoundV2FlowProps {
  context: any;
  currentUser: User | null;
  onExit: () => void;
}

type Step = 'answer' | 'result';

export function RoundV2Flow({ context, currentUser, onExit }: RoundV2FlowProps) {
  const [step, setStep] = useState<Step>('answer');
  const [riddleTheme, setRiddleTheme] = useState<Theme | null>(null);
  const [riddleId, setRiddleId] = useState<string | null>(null);
  const [riddleText, setRiddleText] = useState<string>('⏳ Generating riddle…');
  const [answerText, setAnswerText] = useState<string>('');
  // Elapsed seconds shown in the UI; derived from startedAt via a simple tick.
  // Avoid relying on interval closures capturing stale state.
  const [elapsed, setElapsed] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ total: number; feedback: string } | null>(null);
  // Trigger object to kick off async riddle creation via useAsync
  const [riddleRequest, setRiddleRequest] = useState<{ themeId: string; themeName: string; nonce: number } | null>(null);
  const [initializing, setInitializing] = useState(true);

  console.log('[RoundV2Flow] render', {
    step,
    hasUser: !!currentUser,
    theme: riddleTheme?.id,
    riddleId,
    startedAt,
    elapsed,
    riddleTextLen: riddleText?.length ?? 0,
  });

  // Keep a steady heartbeat to force re-render and derive elapsed from startedAt.
  useInterval(() => {
    const now = Date.now();
    if (startedAt && step === 'answer') {
      const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
      setElapsed(secs);
    }

    // Watchdog: if UI is stuck on the placeholder > 15s, force a visible fallback
    if (
      step === 'answer' &&
      startedAt &&
      riddleText?.startsWith('⏳ Generating riddle') &&
      now - startedAt > 15000
    ) {
      console.warn('[RoundV2Flow] watchdog replacing stuck riddle text with fallback');
      setRiddleText(FALLBACK_RIDDLE_TEXT);
    }
  }, 1000);

  useAsync(
    async () => {
      if (!initializing) {
        return null;
      }
      const [randomTheme] = getRandomThemes(1);
      const theme = randomTheme ?? { id: 'mystery', name: 'Mystery', description: 'System generated theme', difficulty: 2 };
      const startTime = Date.now();
      console.log('[RoundV2Flow] initializing round with system-picked theme', { theme: theme.id });
      setRiddleTheme(theme);
      setStartedAt(startTime);
      setElapsed(0);
      setRiddleText('⏳ Generating riddle…');
      setRiddleId(null);
      setAnswerText('');
      setResult(null);
      setRiddleRequest({ themeId: theme.id, themeName: theme.name, nonce: startTime });
      setInitializing(false);
      return null;
    },
    { depends: [initializing ? 'init' : 'ready'] }
  );

  // Perform async riddle creation driven by state; update UI in finally
  {
    useAsync(
      async () => {
        if (!riddleRequest) return null;
        console.log('[RoundV2Flow] useAsync(createRiddle) start', { theme: riddleRequest.themeId });
        const service = new Service(
          context.redis,
          context.reddit,
          { getSetting: context.settings?.get?.bind(context.settings) }
        );
        const username = currentUser?.username || 'anonymous';
        const t0 = Date.now();
        const riddle = await service.createRiddleFromTheme({ theme: riddleRequest.themeId, playerUsername: username });
        console.log('[RoundV2Flow] useAsync(createRiddle) done', { id: riddle.id, ms: Date.now() - t0 });
        return riddle;
      },
      {
        depends: [riddleRequest?.nonce ?? ''],
        finally: (riddle) => {
          if (!riddleRequest) return;
          if (riddle) {
            setRiddleId(riddle.id);
            setRiddleText(riddle.meta?.riddleText ?? '');
          } else {
            // Fallback text if service failed or returned empty
            setRiddleText(FALLBACK_RIDDLE_TEXT);
          }
        },
      }
    );
  }

  const handleSubmitAnswer = async (submittedAnswer?: string) => {
    // Compute latest elapsed defensively from startedAt to avoid any stale state.
    const now = Date.now();
    const computedElapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : elapsed;
    const answer = (submittedAnswer ?? answerText).trim();
    console.log('[RoundV2Flow] handleSubmitAnswer: start', { riddleId, hasAnswer: !!answer, elapsed: computedElapsed });
    if (!riddleId || !answer) return;
    setAnswerText(answer);
    try {
      setIsSubmitting(true);
      const service = new Service(
        context.redis,
        context.reddit,
        { getSetting: context.settings?.get?.bind(context.settings) }
      );
      const username = currentUser?.username || 'anonymous';
      console.log('[RoundV2Flow] handleSubmitAnswer: submitting');
      const resp = await service.submitAnswer({ riddleId, username, answerText: answer, elapsedMs: computedElapsed * 1000 });
      console.log('[RoundV2Flow] handleSubmitAnswer: submitted', { total: resp.total });
      setResult({ total: resp.total, feedback: resp.feedback });
      setStep('result');
    } catch (e) {
      console.error('[RoundV2Flow] handleSubmitAnswer: error', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const answerFormKey = useForm(
    () => ({
      title: 'Answer the riddle',
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
      fields: [
        {
          type: 'string',
          name: 'answer',
          label: 'Your answer',
          required: true,
          placeholder: 'Share your reasoning…',
          maxLength: 300,
          defaultValue: answerText,
        },
      ],
    }),
    async ({ answer }) => {
      const trimmed = (answer ?? '').trim();
      if (!trimmed) {
        console.warn('[RoundV2Flow] answerForm: empty answer submitted');
        return;
      }
      await handleSubmitAnswer(trimmed);
    }
  );

  const promptForAnswer = () => {
    if (isSubmitting) {
      return;
    }
    if (!context?.ui?.showForm) {
      console.warn('[RoundV2Flow] context.ui.showForm is unavailable');
      return;
    }

    try {
      console.log('[RoundV2Flow] promptForAnswer: showing form');
      context.ui.showForm(answerFormKey);
    } catch (err) {
      console.error('[RoundV2Flow] promptForAnswer: error displaying form', err);
    }
  };

  if (step === 'answer') {
    console.log('[RoundV2Flow] rendering answer step', { elapsed, startedAt });
    return (
      <zstack width="100%" height="100%">
        <image
          url="background_2.png"
          width="100%"
          height="100%"
          imageWidth={1536}
          imageHeight={1024}
          resizeMode="cover"
          description="Ancient doorway backdrop"
        />

        <vstack width="100%" height="100%" padding="xsmall" alignment="top center" gap="none">
          <hstack width="100%" alignment="middle start">
            <image
              url="back_icon.png"
              width="120px"
              height="120px"
              imageWidth={354}
              imageHeight={354}
              resizeMode="fit"
              description="Go back to home"
              onPress={() => {
                console.log('[RoundV2Flow] back icon pressed');
                onExit();
              }}
            />
          </hstack>

          <spacer size="small" />

          <vstack alignment="middle center" gap="small" width="100%">
            <spacer height="30px" />
            <zstack width="440px" height="130px">
              <image
                url="riddle_flyer.png"
                width="100%"
                height="100%"
                imageWidth={850}
                imageHeight={260}
                resizeMode="fit"
                description="Aged parchment displaying the riddle"
              />
              <vstack width="100%" height="100%" alignment="middle center" padding="large">
                <text size="large" weight="bold" alignment="middle center">
                  {riddleText}
                </text>
              </vstack>
            </zstack>

            <spacer height="50px" />

            <zstack width="203px" height="106px">
              <image
                url="enter_answer_button.gif"
                width="100%"
                height="100%"
                imageWidth={203}
                imageHeight={106}
                resizeMode="fit"
                description="Animated enter answer button"
                onPress={() => {
                  console.log('[RoundV2Flow] enter answer button pressed');
                  promptForAnswer();
                }}
              />
            </zstack>

            {isSubmitting && (
              <text size="small" color="secondary" alignment="middle center">
                Submitting your answer…
              </text>
            )}
          </vstack>

          <spacer grow />
        </vstack>
      </zstack>
    );
  }

  // result
  console.log('[RoundV2Flow] rendering result step', { result });
  return (
    <zstack width="100%" height="100%">
      <image
        url="background_3.png"
        width="100%"
        height="100%"
        imageWidth={1536}
        imageHeight={1024}
        resizeMode="cover"
        description="Sunlit courtyard backdrop"
      />

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
    </zstack>
  );
}
