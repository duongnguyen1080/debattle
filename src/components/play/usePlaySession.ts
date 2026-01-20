import { useInterval, useState, useAsync, useForm } from '@devvit/public-api';
import { Service } from '../../services/Service.js';
import type { User } from '../../types/index.js';
import { getRandomQuestion, QuestionBankEntry } from '../../utils/questionBank.js';
import { FALLBACK_RIDDLE_TEXT, RoundResult, Step } from './playLayout.js';

interface UsePlaySessionOptions {
  context: any;
  currentUser: User | null;
}

interface UsePlaySessionResult {
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
}

const MAX_MEANINGFUL_ANSWER_LENGTH = 200;
const ANSWER_LENGTH_LIMIT_MESSAGE =
  'Answers are limited to 200 characters (spaces and punctuation excluded).';

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

export function usePlaySession({ context, currentUser }: UsePlaySessionOptions): UsePlaySessionResult {
  const fireToast = (message: string, logScope: string): void => {
    const ui = context?.ui;
    if (!ui?.showToast) {
      return;
    }
    const warnPrefix = `[usePlaySession] ${logScope}`;
    try {
      const maybePromise = ui.showToast(message) as Promise<void> | void;
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        (maybePromise as Promise<void>).catch((err: unknown) => {
          console.warn(warnPrefix, err);
        });
      }
    } catch (err) {
      console.warn(warnPrefix, err);
    }
  };

  const navigateToPost = async (postId?: string | null, permalink?: string | null): Promise<void> => {
    const ui = context?.ui;
    if (!ui?.navigateTo) {
      console.log('[usePlaySession] shareToSubreddit: ui.navigateTo not available');
      return;
    }

    if (postId && context?.reddit?.getPostById) {
      try {
        const post = await context.reddit.getPostById(postId);
        if (post?.url) {
          console.log('[usePlaySession] shareToSubreddit: navigating to post', {
            postId,
            url: post.url,
          });
          ui.navigateTo(post);
          return;
        }
      } catch (err) {
        console.warn('[usePlaySession] shareToSubreddit: post lookup failed', err);
      }
    }

    if (!permalink) {
      console.warn('[usePlaySession] shareToSubreddit: missing permalink for navigation');
      return;
    }
    const url = permalink.startsWith('http') ? permalink : `https://reddit.com${permalink}`;
    console.log('[usePlaySession] shareToSubreddit: navigating to permalink', { permalink, url });
    try {
      ui.navigateTo(url);
    } catch (err) {
      console.warn('[usePlaySession] shareToSubreddit: navigateTo failed', err);
    }
  };

  const [initialQuestion] = useState<QuestionBankEntry | null>(() => {
    try {
      return getRandomQuestion();
    } catch (err) {
      console.error('[usePlaySession] failed to fetch initial question from bank', err);
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
      console.warn('[usePlaySession] watchdog replacing stuck riddle text with fallback');
      setRiddleText(FALLBACK_RIDDLE_TEXT);
    }
  }, 1000);

  useAsync(
    async () => {
      if (!roundNonce) {
        return null;
      }
      const startTime = Date.now();
      console.log('[usePlaySession] starting round', {
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
      console.log('[usePlaySession] createRiddle complete', { id: riddle?.id ?? null, ms: Date.now() - t0 });
      return riddle;
    },
    {
      depends: [roundNonce],
      finally: (riddle, error) => {
        if (!roundNonce) {
          return;
        }
        if (error) {
          console.error('[usePlaySession] createRiddle error', error);
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
    console.log('[usePlaySession] handleSubmitAnswer: start', {
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
      console.log('[usePlaySession] handleSubmitAnswer: submitting');
      const resp = await service.submitAnswer({
        riddleId,
        playerUsername: username,
        answerText: answer,
        elapsed: computedElapsed * 1000,
      });
      console.log('[usePlaySession] handleSubmitAnswer: submitted', {
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
      console.error('[usePlaySession] handleSubmitAnswer: error', e);
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
          type: 'paragraph',
          name: 'answer',
          label: 'Your answer (max 200 characters)',
          required: true,
          placeholder: 'Share your reasoning (200 characters)...',
          lineHeight: 6,
          defaultValue: answerText,
        },
      ],
    }),
    async ({ answer }) => {
      const trimmed = (answer ?? '').trim();
      if (!trimmed) {
        console.warn('[usePlaySession] answerForm: empty answer submitted');
        return;
      }
      const meaningfulLength = getMeaningfulAnswerLength(trimmed);
      if (meaningfulLength > MAX_MEANINGFUL_ANSWER_LENGTH) {
        console.warn('[usePlaySession] answerForm: answer exceeds length limit', {
          trimmedLength: trimmed.length,
          meaningfulLength,
        });
        fireToast(ANSWER_LENGTH_LIMIT_MESSAGE, 'answerForm: limit toast failed');
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
      console.warn('[usePlaySession] context.ui.showForm is unavailable');
      return;
    }

    try {
      console.log('[usePlaySession] promptForAnswer: showing form');
      context.ui.showForm(answerFormKey);
    } catch (err) {
      console.error('[usePlaySession] promptForAnswer: error displaying form', err);
    }
  };

  const shareToSubreddit = async () => {
    if (!result || !riddleId) {
      console.warn('[usePlaySession] shareToSubreddit: missing result or riddleId');
      return;
    }
    console.log('[usePlaySession] shareToSubreddit: start', {
      riddleId,
      responseId: result.responseId,
      hasSharePostId: !!result.sharePostId,
    });
    if (isSharing) {
      console.log('[usePlaySession] shareToSubreddit: already in progress');
      return;
    }
    const alreadyShared = !!result.sharePostId;

    try {
      setIsSharing(true);
      const service = new Service(
        context.redis,
        context.reddit,
        { getSetting: context.settings?.get?.bind(context.settings) }
      );
      const username = currentUser?.username || 'anonymous';
      console.log('[usePlaySession] shareToSubreddit: submitting post', {
        username,
        questionLength: result.questionText?.length ?? 0,
        answerLength: result.answerText?.length ?? 0,
      });
      const shareScoreValue = result.areteEvaluation?.totalPoints ?? result.score.total;
      const shareFeedback = result.areteEvaluation?.feedback ?? result.feedback;
      const resp = await service.shareResponseToSubreddit({
        riddleId,
        responseId: result.responseId,
        questionText: result.questionText,
        answerText: result.answerText,
        playerUsername: username,
        totalScore: shareScoreValue,
        decision: result.decision,
        feedback: shareFeedback,
      });
      console.log('[usePlaySession] shareToSubreddit: submit ok', {
        postId: resp.postId,
        permalink: resp.permalink ?? null,
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
      console.log('[usePlaySession] shareToSubreddit: updated local share state', {
        postId: resp.postId,
        permalink: resp.permalink ?? null,
      });
      const toastMessage = alreadyShared
        ? 'Already shared — opening post.'
        : 'Shared to the community!';
      fireToast(toastMessage, 'shareToSubreddit: success toast failed');
      const permalink = resp.permalink ?? result.sharePermalink;
      await navigateToPost(resp.postId, permalink);
    } catch (err) {
      console.error('[usePlaySession] shareToSubreddit: error', err);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Scope.SUBMIT_POST') || message.includes('userActions') || message.includes('runAs')) {
        fireToast(
          'Please allow Debattle to post as you to share.',
          'shareToSubreddit: permission toast failed',
        );
      } else {
        fireToast('Failed to share to the subreddit', 'shareToSubreddit: error toast failed');
      }
    } finally {
      setIsSharing(false);
      console.log('[usePlaySession] shareToSubreddit: finished');
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
  };
}
