import { Devvit, useInterval, useState, useAsync, useForm } from '@devvit/public-api';
import { Service } from '../../services/Service.js';
import { User, Theme } from '../../types/index.js';
import { getRandomThemes } from '../../utils/gameUtils.js';
import { WrappedFontText, measureWrappedText } from './FontText.js';

const FALLBACK_RIDDLE_TEXT = 'Consider this: What do you owe to yourself that cannot be owned?';

// --- style ---
const RIDDLE_STYLE = {
  color: '#231414',
  fontSize: 40,
  lineGap: 10,
  letterSpacing: -2,
  targetLinesMin: 2,
  targetLinesMax: 5,
} as const;

// --- parchment + responsive bounds ---
const PARCHMENT = {
  minWidth: 560,
  maxWidth: 860,
  capTop: 72,
  capBottom: 72,
  midTile: 48,
  padX: 40,
  padY: 28,
  minHeight: 140,
  maxHeight: 300,
} as const;

const VIEW = {
  minWidth: 520,
  maxWidth: 900,
} as const;

const LAYOUT = {
  maxParchmentFraction: 0.55,
  buttonGapFraction: 0.02,
} as const;

const SLICE_PIXEL_DIMENSIONS = {
  top: { width: 816, height: 74 },
  mid: { width: 816, height: 104 },
  bottom: { width: 811, height: 64 },
} as const;

interface RoundV2FlowProps {
  context: any;
  currentUser: User | null;
  onExit: () => void;
}

type Step = 'answer' | 'result';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

function chooseResponsiveWidth(text: string): number {
  const { minWidth, maxWidth, padX } = PARCHMENT;
  const { fontSize, letterSpacing, lineGap, targetLinesMin, targetLinesMax } = RIDDLE_STYLE;

  if (maxWidth <= minWidth) {
    return clamp(minWidth, VIEW.minWidth, VIEW.maxWidth);
  }

  const candidates: number[] = [];
  for (let width = minWidth; width <= maxWidth; width += 40) {
    candidates.push(width);
  }
  if (candidates[candidates.length - 1] !== maxWidth) {
    candidates.push(maxWidth);
  }

  let bestWidth = maxWidth;
  let bestDiff = Number.POSITIVE_INFINITY;
  let sawAbove = false;
  let sawBelow = false;

  for (const width of candidates) {
    const contentWidth = Math.max(1, width - padX * 2);
    const { lineCount } = measureWrappedText({
      text,
      maxWidth: contentWidth,
      fontSize,
      letterSpacing,
      lineGap,
    });

    if (lineCount >= targetLinesMin && lineCount <= targetLinesMax) {
      return clamp(width, VIEW.minWidth, VIEW.maxWidth);
    }

    if (lineCount > targetLinesMax) {
      sawAbove = true;
      const diff = lineCount - targetLinesMax;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestWidth = width;
      }
    } else if (lineCount < targetLinesMin) {
      sawBelow = true;
      const diff = targetLinesMin - lineCount;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestWidth = width;
      }
    }
  }

  if (sawAbove && !sawBelow) {
    return clamp(PARCHMENT.maxWidth, VIEW.minWidth, VIEW.maxWidth);
  }
  if (sawBelow && !sawAbove) {
    return clamp(PARCHMENT.minWidth, VIEW.minWidth, VIEW.maxWidth);
  }

  return clamp(bestWidth, VIEW.minWidth, VIEW.maxWidth);
}

function computeParchmentLayout(text: string) {
  const width = chooseResponsiveWidth(text);
  const { capTop, capBottom, midTile, padX, padY, minHeight, maxHeight } = PARCHMENT;
  const { fontSize, letterSpacing, lineGap } = RIDDLE_STYLE;

  const contentWidth = Math.max(1, width - padX * 2);

  const { totalHeight } = measureWrappedText({
    text,
    maxWidth: contentWidth,
    fontSize,
    letterSpacing,
    lineGap,
  });

  const neededInner = totalHeight + padY * 2;
  const minInner = Math.max(minHeight, capTop + capBottom);
  const maxInner = Math.max(minInner, maxHeight);
  const clampedInner = clamp(neededInner, minInner, maxInner);
  const middleBand = Math.max(0, clampedInner - capTop - capBottom);
  const tiles = middleBand > 0 ? Math.ceil(middleBand / midTile) : 0;
  const flyerHeight = capTop + tiles * midTile + capBottom;
  const extraPadY = Math.max(0, (flyerHeight - neededInner) / 2);
  const needsScroll = neededInner > flyerHeight;

  return {
    width,
    contentWidth,
    innerHeight: flyerHeight,
    flyerHeight,
    tiles,
    extraPadY,
    needsScroll,
  };
}

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
  const [result, setResult] = useState<{
    score: { wit: number; logic: number; style: number; total: number };
    feedback: string;
    decision: 'open' | 'ajar' | 'closed';
  } | null>(null);
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
    if (step !== 'answer') {
      return;
    }
    const now = Date.now();
    let secs = elapsed;
    if (startedAt) {
      secs = Math.max(0, Math.floor((now - startedAt) / 1000));
      if (secs !== elapsed) {
        setElapsed(secs);
      }
    }

    // Watchdog: if UI is stuck on the placeholder > 15s, force a visible fallback
    if (riddleText?.startsWith('⏳ Generating riddle') && secs >= 15) {
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
      return { theme, startTime, nonce: startTime };
    },
    {
      depends: [initializing ? 'init' : 'ready'],
      finally: (payload, error) => {
        if (!initializing) {
          return;
        }
        if (!payload?.theme) {
          if (error) {
            console.error('[RoundV2Flow] init useAsync error', error);
          }
          setInitializing(false);
          return;
        }
        const { theme, startTime, nonce } = payload;
        setRiddleTheme(theme);
        setStartedAt(startTime);
        setElapsed(0);
        setRiddleText('⏳ Generating riddle…');
        setRiddleId(null);
        setAnswerText('');
        setResult(null);
        setRiddleRequest({ themeId: theme.id, themeName: theme.name, nonce });
        setInitializing(false);
      },
    }
  );

  // Perform async riddle creation driven by state; update UI in finally
  {
    useAsync(
      async () => {
        if (!riddleRequest) {
          return null;
        }
        console.log('[RoundV2Flow] useAsync(createRiddle) start', { theme: riddleRequest.themeId });
        const service = new Service(
          context.redis,
          context.reddit,
          { getSetting: context.settings?.get?.bind(context.settings) }
        );
        const username = currentUser?.username || 'anonymous';
        const t0 = Date.now();
        const riddle = await service.createRiddleFromTheme({ theme: riddleRequest.themeId, playerUsername: username });
        console.log('[RoundV2Flow] useAsync(createRiddle) done', { id: riddle?.id ?? null, ms: Date.now() - t0 });
        return riddle;
      },
      {
        depends: [riddleRequest?.nonce ?? ''],
        finally: (riddle, error) => {
          if (!riddleRequest) {
            return;
          }
          if (error) {
            console.error('[RoundV2Flow] useAsync(createRiddle) error', error);
          }
          if (riddle && riddle.meta?.riddleText) {
            setRiddleId(riddle.id);
            setRiddleText(riddle.meta.riddleText);
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
      const resp = await service.submitAnswer({ riddleId, playerUsername: username, answerText: answer, elapsed: computedElapsed * 1000 });
      console.log('[RoundV2Flow] handleSubmitAnswer: submitted', { total: resp.score.total, decision: resp.decision });
      setResult(resp);
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
    const { color, fontSize, lineGap, letterSpacing } = RIDDLE_STYLE;
    const viewportHeight = context?.viewportHeight ?? 1024;
    const maxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
    const buttonGap = viewportHeight * LAYOUT.buttonGapFraction;
    const {
      width: flyerW,
      contentWidth,
      innerHeight,
      flyerHeight,
      tiles,
      extraPadY,
      needsScroll,
    } = computeParchmentLayout(riddleText);
    const padTop = PARCHMENT.padY + extraPadY;
    const padBottom = PARCHMENT.padY + extraPadY;
    const clampedFlyerHeight = Math.min(flyerHeight, maxParchmentHeight);
    const parchmentOffset = Math.max(0, (maxParchmentHeight - clampedFlyerHeight) / 3);

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

          <vstack alignment="middle center" gap="none" width="100%" height="100%">
            <spacer height="30px" />
            <vstack
              width="100%"
              alignment="top center"
              gap="none"
              paddingTop={`${parchmentOffset}px`}
            >
              <zstack
                width={`${flyerW}px`}
                height={`${clampedFlyerHeight}px`}
                alignment="top center"
              >
                <vstack width="100%" height="100%" alignment="top center" gap="none">
                  <image
                    url="riddle_top.png"
                    width="100%"
                    height={`${PARCHMENT.capTop}px`}
                    imageWidth={SLICE_PIXEL_DIMENSIONS.top.width}
                    imageHeight={SLICE_PIXEL_DIMENSIONS.top.height}
                    resizeMode="fill"
                    description="Top parchment edge"
                  />
                  {Array.from({ length: tiles }).map((_, index) => (
                    <image
                      key={`riddle-mid-${index}`}
                      url="riddle_mid.png"
                      width="100%"
                      height={`${PARCHMENT.midTile}px`}
                      imageWidth={SLICE_PIXEL_DIMENSIONS.mid.width}
                      imageHeight={SLICE_PIXEL_DIMENSIONS.mid.height}
                      resizeMode="fill"
                      description="Parchment middle texture"
                    />
                  ))}
                  <image
                    url="riddle_bottom.png"
                    width="100%"
                    height={`${PARCHMENT.capBottom}px`}
                    imageWidth={SLICE_PIXEL_DIMENSIONS.bottom.width}
                    imageHeight={SLICE_PIXEL_DIMENSIONS.bottom.height}
                    resizeMode="fill"
                    description="Bottom parchment edge"
                  />
                </vstack>

                <vstack
                  width="100%"
                  height={`${innerHeight}px`}
                  padding={{
                    top: `${padTop}px`,
                    bottom: `${padBottom}px`,
                    left: `${PARCHMENT.padX}px`,
                    right: `${PARCHMENT.padX}px`,
                  }}
                  alignment="middle center"
                  scroll={needsScroll ? 'vertical' : undefined}
                >
                  <WrappedFontText
                    text={riddleText}
                    maxWidth={contentWidth}
                    color={color}
                    fontSize={fontSize}
                    letterSpacing={letterSpacing}
                    lineGap={lineGap}
                    align="center"
                  />
                </vstack>
              </zstack>

              <spacer height={`${buttonGap}px`} />

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
            <text size="large">Score: {result.score.total}/15</text>
            <text size="medium" color="secondary">Decision: {result.decision}</text>
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
