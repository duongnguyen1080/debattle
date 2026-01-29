import type { AppUpgrade, TriggerContext } from '@devvit/public-api';
import { refreshUiAssets } from '../../utils/uiAssets.js';

export interface EventFlow {
  onEvent(
    event: { comment: { body: string; author: string; id: string }; post: { id: string } },
    context: TriggerContext
  ): Promise<void>;
  handleAppUpgrade(event: AppUpgrade, context: TriggerContext): Promise<void>;
}

export function createEventFlow(deps: {
  cleanupExpiredRiddles: () => Promise<void>;
}): EventFlow {
  const { cleanupExpiredRiddles } = deps;

  const onEvent: EventFlow['onEvent'] = async (event, context) => {
    if (typeof event !== 'object' || !event.comment || !event.post) {
      console.error('Invalid event structure:', event);
      return;
    }
    void context;
    return;
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
