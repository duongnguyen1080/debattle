import { Devvit, useInterval, useState, useAsync, useForm } from '@devvit/public-api';
import { Service } from '../../services/Service.js';
import { User } from '../../types/index.js';
import { WrappedFontText, measureWrappedText } from './FontText.js';
import { WrappedAnswerFontText } from './AnswerFontText.js';
import { getRandomQuestion, QuestionBankEntry } from '../../utils/questionBank.js';

const FALLBACK_RIDDLE_TEXT = 'What do you owe to yourself that cannot be owned?';

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
  padY: 20,
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

type RoundResult = {
  score: { wit: number; logic: number; style: number; total: number };
  feedback: string;
  decision: 'open' | 'ajar' | 'closed';
  questionText: string;
  answerText: string;
};

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
  const [initialQuestion] = useState<QuestionBankEntry | null>(() => {
    try {
      return getRandomQuestion();
    } catch (err) {
      console.error('[RoundV2Flow] failed to fetch initial question from bank', err);
      return null;
    }
  }, []);
  const initialRiddleText = initialQuestion?.question ?? FALLBACK_RIDDLE_TEXT;
  const [step, setStep] = useState<Step>('answer');
  const [riddleId, setRiddleId] = useState<string | null>(null);
  const [riddleText, setRiddleText] = useState<string>(initialRiddleText);
  const [answerText, setAnswerText] = useState<string>('');
  // Elapsed seconds shown in the UI; derived from startedAt via a simple tick.
  // Avoid relying on interval closures capturing stale state.
  const [elapsed, setElapsed] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<number | null>(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundNonce] = useState<number>(() => Date.now());
  const viewportHeight = context?.viewportHeight ?? 1024;

  console.log('[RoundV2Flow] render', {
    step,
    hasUser: !!currentUser,
    roundNonce,
    questionId: initialQuestion?.id ?? null,
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

    // Watchdog: if UI is stuck on the placeholder > 5s, force a visible fallback
    if (riddleText?.startsWith('⏳ Generating riddle') && secs >= 5) {
      console.warn('[RoundV2Flow] watchdog replacing stuck riddle text with fallback');
      setRiddleText(FALLBACK_RIDDLE_TEXT);
    }
  }, 1000);

  useAsync(
    async () => {
      if (!roundNonce) {
        return null;
      }
      const startTime = Date.now();
      console.log('[RoundV2Flow] starting round', { nonce: roundNonce, questionId: initialQuestion?.id ?? null });
      setStartedAt(startTime);
      setElapsed(0);
      setRiddleId(null);
      setAnswerText('');
      setResult(null);

      const service = new Service(
        context.redis,
        context.reddit,
        { getSetting: context.settings?.get?.bind(context.settings) }
      );
      const username = currentUser?.username || 'anonymous';
      const t0 = Date.now();
      const riddle = await service.createRiddleFromTheme({
        theme: 'any',
        playerUsername: username,
        question: initialQuestion ?? undefined,
      });
      console.log('[RoundV2Flow] createRiddle complete', { id: riddle?.id ?? null, ms: Date.now() - t0 });
      return riddle;
    },
    {
      depends: [roundNonce],
      finally: (riddle, error) => {
        if (!roundNonce) {
          return;
        }
        if (error) {
          console.error('[RoundV2Flow] createRiddle error', error);
        }
        if (riddle && riddle.meta?.riddleText) {
          setRiddleId(riddle.id);
          setRiddleText(riddle.meta.riddleText);
        } else if (!initialQuestion) {
          // Fallback text if service failed and no initial question was available
          setRiddleText(FALLBACK_RIDDLE_TEXT);
        }
      },
    }
  );

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
      const resp = await service.submitAnswer({
        riddleId,
        playerUsername: username,
        answerText: answer,
        elapsed: computedElapsed * 1000,
      });
      console.log('[RoundV2Flow] handleSubmitAnswer: submitted', { total: resp.score.total, decision: resp.decision });
      setResult({
        ...resp,
        questionText: riddleText,
        answerText: answer,
      });
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
                  url="enter_answer_button.png"
                  width="100%"
                  height="100%"
                  imageWidth={203}
                  imageHeight={106}
                  resizeMode="fit"
                  description="Enter answer button"
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

  console.log('[RoundV2Flow] rendering result step', { result });
  if (!result) {
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
        <vstack width="100%" height="100%" alignment="middle center" gap="medium">
          <text size="large">Gathering your results…</text>
          <button appearance="secondary" onPress={onExit}>🏠 Back to Home</button>
        </vstack>
      </zstack>
    );
  }

  const resultQuestion = result.questionText || riddleText;
  const resultAnswer = result.answerText || 'No answer submitted.';
  const resultMeasureText = `${resultQuestion}\n${resultAnswer}`;
  const resultMaxParchmentHeight = viewportHeight * LAYOUT.maxParchmentFraction;
  const {
    width: resultFlyerW,
    contentWidth: resultContentWidth,
    innerHeight: resultInnerHeight,
    flyerHeight: resultFlyerHeight,
    tiles: resultTiles,
    extraPadY: resultExtraPadY,
    needsScroll: resultNeedsScroll,
  } = computeParchmentLayout(resultMeasureText);
  const resultPadTop = PARCHMENT.padY + resultExtraPadY;
  const resultPadBottom = PARCHMENT.padY + resultExtraPadY;
  const resultClampedHeight = Math.min(resultFlyerHeight, resultMaxParchmentHeight);
  const resultOffset = Math.max(0, (resultMaxParchmentHeight - resultClampedHeight) / 3);

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

      <vstack width="100%" height="100%" padding="large" alignment="top center" gap="large">
        <spacer size="small" />
        <vstack width="100%" alignment="top center" gap="none" paddingTop={`${resultOffset}px`}>
          <zstack
            width={`${resultFlyerW}px`}
            height={`${resultClampedHeight}px`}
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
              {Array.from({ length: resultTiles }).map((_, index) => (
                <image
                  key={`result-mid-${index}`}
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
              height={`${resultInnerHeight}px`}
              padding={{
                top: `${resultPadTop}px`,
                bottom: `${resultPadBottom}px`,
                left: `${PARCHMENT.padX}px`,
                right: `${PARCHMENT.padX}px`,
              }}
              alignment="middle center"
              scroll={resultNeedsScroll ? 'vertical' : undefined}
              gap="medium"
            >
              <text size="large" color="#4b2d15">
                Nice expression!
              </text>
              <WrappedFontText
                text={resultQuestion}
                maxWidth={resultContentWidth}
                color={RIDDLE_STYLE.color}
                fontSize={RIDDLE_STYLE.fontSize}
                letterSpacing={RIDDLE_STYLE.letterSpacing}
                lineGap={RIDDLE_STYLE.lineGap}
                align="center"
              />
              <WrappedAnswerFontText
                text={`“${resultAnswer}”`}
                maxWidth={resultContentWidth}
                fontSize={24}
                letterSpacing={-1.2}
                lineGap={30}
                color="#2b1e12"
                align="center"
              />
            </vstack>
          </zstack>
        </vstack>

        <vstack alignment="middle center" gap="xsmall">
          <text size="large">Score: {result.score.total}/15</text>
          <text size="medium" color="secondary">Decision: {result.decision}</text>
          <text size="small" color="secondary">Arete: “{result.feedback}”</text>
        </vstack>

        <spacer grow />

        <button appearance="primary" width="60%" onPress={onExit}>
          🏠 Back to Home
        </button>
      </vstack>
    </zstack>
  );
}
