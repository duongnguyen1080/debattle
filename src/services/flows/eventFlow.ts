import type { AppUpgrade, TriggerContext } from '@devvit/public-api';
import { refreshUiAssets } from '../../utils/uiAssets.js';
import type { SubmitAnswerParams, SubmitAnswerResult } from './answerFlow.js';

export interface EventFlow {
  onEvent(
    event: { comment: { body: string; author: string; id: string }; post: { id: string } },
    context: TriggerContext
  ): Promise<void>;
  handleAppUpgrade(event: AppUpgrade, context: TriggerContext): Promise<void>;
}

export function createEventFlow(deps: {
  submitAnswer: (params: SubmitAnswerParams) => Promise<SubmitAnswerResult>;
  decisionSummary: (decision: 'open' | 'ajar' | 'closed') => { label: string; emoji: string };
  cleanupExpiredRiddles: () => Promise<void>;
}): EventFlow {
  const { submitAnswer, decisionSummary, cleanupExpiredRiddles } = deps;

  const onEvent: EventFlow['onEvent'] = async (event, context) => {
    if (typeof event !== 'object' || !event.comment || !event.post) {
      console.error('Invalid event structure:', event);
      return;
    }
    const { comment, post } = event;
    const body = comment.body.trim();

    // Player submits an answer (expects: !answer <elapsed_ms> | <text>)
    if (body.toLowerCase().startsWith('!answer ')) {
      const payload = body.slice('!answer '.length).trim();
      const pipeIdx = payload.indexOf('|');
      if (pipeIdx > -1) {
        const elapsed = Number(payload.slice(0, pipeIdx).trim());
        const answerText = payload.slice(pipeIdx + 1).trim();
        if (!Number.isNaN(elapsed) && answerText) {
          try {
            const resp = await submitAnswer({
              riddleId: post.id,
              playerUsername: comment.author,
              answerText,
              elapsed,
            });
            const hasAreteScore = typeof resp.areteEvaluation?.totalPoints === 'number';
            const areteScoreValue = hasAreteScore
              ? Math.round(resp.areteEvaluation!.totalPoints)
              : resp.score.total;
            const areteScoreMax = hasAreteScore ? 90 : 15;
            const decisionLabel = decisionSummary(resp.decision).label;
            await context.reddit.submitComment({
              id: comment.id,
              text: `\uD83E\uDDE0 Answer received. Score: **${areteScoreValue}/${areteScoreMax}**. Decision: **${decisionLabel}**. Feedback: _${resp.feedback}_`,
            });
          } catch (e) {
            console.error('Error scoring answer:', e);
          }
        }
      }
      return;
    }
  };

  const handleAppUpgrade: EventFlow['handleAppUpgrade'] = async (event, context) => {
    void event;
    const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubredditName());
    console.log('App upgraded for subreddit:', subredditName ?? '(unknown)');

    try {
      await refreshUiAssets(context);
    } catch (err) {
      console.warn('[ui-assets] refresh failed', err);
    }

    await cleanupExpiredRiddles();
  };

  return { onEvent, handleAppUpgrade };
}
