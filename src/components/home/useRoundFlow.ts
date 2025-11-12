import { useInterval, useState, useAsync, useForm } from '@devvit/public-api';
import { Service } from '../../services/Service.js';
import type { User } from '../../types/index.js';
import { getRandomQuestion, QuestionBankEntry } from '../../utils/questionBank.js';
import { FALLBACK_RIDDLE_TEXT, RoundResult, Step } from './roundTypes.js';

interface UseRoundFlowOptions {
  context: any;
  currentUser: User | null;
}

interface UseRoundFlowResult {
  step: Step;
  riddleText: string;
  result: RoundResult | null;
  isSubmitting: boolean;
  isSharing: boolean;
  viewportHeight: number;
  promptForAnswer: () => void;
  elapsed: number;
  startedAt: number | null;
  roundNonce: number;
  riddleId: string | null;
  initialQuestionId: string | null;
  shareToSubreddit: () => Promise<void>;
  hasShared: boolean;
  sharePermalink: string | null;
}

const MAX_MEANINGFUL_ANSWER_LENGTH = 100;
const ANSWER_LENGTH_LIMIT_MESSAGE =
  'Answers are limited to 100 characters (spaces and punctuation excluded).';

const createIgnoredCharRegex = (): RegExp => {
  try {
    return new RegExp('[\\s\\p{P}]', 'gu');
  } catch {
    return /[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
  }
};

const IGNORED_ANSWER_CHAR_REGEX = createIgnoredCharRegex();

const getMeaningfulAnswerLength = (value: string): number => {
  if (!value) {
    return 0;
  }
  return value.replace(IGNORED_ANSWER_CHAR_REGEX, '').length;
};

export function useRoundFlow({ context, currentUser }: UseRoundFlowOptions): UseRoundFlowResult {
  const [initialQuestion] = useState<QuestionBankEntry | null>(() => {
    try {
      return getRandomQuestion();
    } catch (err) {
      console.error('[useRoundFlow] failed to fetch initial question from bank', err);
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
  const [isSharing, setIsSharing] = useState(false);
  const [roundNonce] = useState<number>(() => Date.now());
  const viewportHeight = context?.viewportHeight ?? 1024;

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
      console.warn('[useRoundFlow] watchdog replacing stuck riddle text with fallback');
      setRiddleText(FALLBACK_RIDDLE_TEXT);
    }
  }, 1000);

  useAsync(
    async () => {
      if (!roundNonce) {
        return null;
      }
      const startTime = Date.now();
      console.log('[useRoundFlow] starting round', {
        nonce: roundNonce,
        questionId: initialQuestion?.id ?? null,
      });
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
      console.log('[useRoundFlow] createRiddle complete', { id: riddle?.id ?? null, ms: Date.now() - t0 });
      return riddle;
    },
    {
      depends: [roundNonce],
      finally: (riddle, error) => {
        if (!roundNonce) {
          return;
        }
        if (error) {
          console.error('[useRoundFlow] createRiddle error', error);
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
    console.log('[useRoundFlow] handleSubmitAnswer: start', {
      riddleId,
      hasAnswer: !!answer,
      elapsed: computedElapsed,
    });
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
      console.log('[useRoundFlow] handleSubmitAnswer: submitting');
      const resp = await service.submitAnswer({
        riddleId,
        playerUsername: username,
        answerText: answer,
        elapsed: computedElapsed * 1000,
      });
      console.log('[useRoundFlow] handleSubmitAnswer: submitted', {
        total: resp.score.total,
        decision: resp.decision,
      });
      setResult({
        score: resp.score,
        feedback: resp.feedback,
        decision: resp.decision,
        questionText: riddleText,
        answerText: answer,
        responseId: resp.responseId,
        areteEvaluation: resp.areteEvaluation,
      });
      setStep('result');
    } catch (e) {
      console.error('[useRoundFlow] handleSubmitAnswer: error', e);
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
          label: 'Your answer (max 100 characters, spaces & punctuation excluded)',
          required: true,
          placeholder: 'Share your reasoning (100 char max, spaces/punctuation excluded)...',
          maxLength: 300,
          defaultValue: answerText,
        },
      ],
    }),
    async ({ answer }) => {
      const trimmed = (answer ?? '').trim();
      if (!trimmed) {
        console.warn('[useRoundFlow] answerForm: empty answer submitted');
        return;
      }
      const meaningfulLength = getMeaningfulAnswerLength(trimmed);
      if (meaningfulLength > MAX_MEANINGFUL_ANSWER_LENGTH) {
        console.warn('[useRoundFlow] answerForm: answer exceeds length limit', {
          trimmedLength: trimmed.length,
          meaningfulLength,
        });
        if (context?.ui?.showToast) {
          try {
            await context.ui.showToast(ANSWER_LENGTH_LIMIT_MESSAGE);
          } catch (toastErr) {
            console.warn('[useRoundFlow] answerForm: limit toast failed', toastErr);
          }
        }
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
      console.warn('[useRoundFlow] context.ui.showForm is unavailable');
      return;
    }

    try {
      console.log('[useRoundFlow] promptForAnswer: showing form');
      context.ui.showForm(answerFormKey);
    } catch (err) {
      console.error('[useRoundFlow] promptForAnswer: error displaying form', err);
    }
  };

  const shareToSubreddit = async () => {
    if (!result || !riddleId) {
      console.warn('[useRoundFlow] shareToSubreddit: missing result or riddleId');
      return;
    }
    if (isSharing) {
      return;
    }
    if (result.sharePostId) {
      console.log('[useRoundFlow] shareToSubreddit: already shared');
      if (context?.ui?.showToast) {
        try {
          await context.ui.showToast('Already shared to the subreddit');
        } catch (err) {
          console.warn('[useRoundFlow] shareToSubreddit: toast failed', err);
        }
      }
      return;
    }

    try {
      setIsSharing(true);
      const service = new Service(
        context.redis,
        context.reddit,
        { getSetting: context.settings?.get?.bind(context.settings) }
      );
      const username = currentUser?.username || 'anonymous';
      console.log('[useRoundFlow] shareToSubreddit: submitting post');
      const resp = await service.shareResponseToSubreddit({
        riddleId,
        responseId: result.responseId,
        questionText: result.questionText,
        answerText: result.answerText,
        playerUsername: username,
        totalScore: result.score.total,
        decision: result.decision,
        feedback: result.feedback,
      });
      setResult((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          sharePostId: resp.postId,
          sharePermalink: resp.permalink ?? prev.sharePermalink,
        };
      });
      if (context?.ui?.showToast) {
        try {
          await context.ui.showToast('Shared to the community!');
        } catch (err) {
          console.warn('[useRoundFlow] shareToSubreddit: success toast failed', err);
        }
      }
    } catch (err) {
      console.error('[useRoundFlow] shareToSubreddit: error', err);
      if (context?.ui?.showToast) {
        try {
          await context.ui.showToast('Failed to share to the subreddit');
        } catch (toastErr) {
          console.warn('[useRoundFlow] shareToSubreddit: error toast failed', toastErr);
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  return {
    step,
    riddleText,
    result,
    isSubmitting,
    isSharing,
    viewportHeight,
    promptForAnswer,
    elapsed,
    startedAt,
    roundNonce,
    riddleId,
    initialQuestionId: initialQuestion?.id ?? null,
    shareToSubreddit,
    hasShared: !!result?.sharePostId,
    sharePermalink: result?.sharePermalink ?? null,
  };
}
