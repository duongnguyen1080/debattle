import { RedisClient, RedditAPIClient, AppUpgrade, TriggerContext } from '@devvit/public-api';
import { User, RiddleV2 } from '../types/index.js';
import { createAnswerFlow, type SubmitAnswerParams, type SubmitAnswerResult } from './flows/answerFlow.js';
import { createEventFlow } from './flows/eventFlow.js';
import { createRiddleFlow, type CreateRiddleFromThemeParams } from './flows/riddleFlow.js';
import { createShareFlow, type ShareResponseParams, type ShareResponseResult } from './flows/shareFlow.js';
import { createUserFlow } from './flows/userFlow.js';

export class Service {
  private riddleFlow: ReturnType<typeof createRiddleFlow>;
  private answerFlow: ReturnType<typeof createAnswerFlow>;
  private shareFlow: ReturnType<typeof createShareFlow>;
  private userFlow: ReturnType<typeof createUserFlow>;
  private eventFlow: ReturnType<typeof createEventFlow>;

  constructor(
    private redis: RedisClient,
    private reddit: RedditAPIClient,
    private opts?: { getSetting?: (key: string) => Promise<string | null | undefined> }
  ) {
    this.riddleFlow = createRiddleFlow({ redis: this.redis });
    this.userFlow = createUserFlow({
      redis: this.redis,
      reddit: this.reddit,
      resolveSubredditName: this.resolveSubredditName.bind(this),
    });
    this.answerFlow = createAnswerFlow({
      riddleFlow: this.riddleFlow,
      updateUserXp: this.userFlow.updateUserXp,
      getSetting: this.opts?.getSetting,
    });
    this.shareFlow = createShareFlow({
      reddit: this.reddit,
      riddleFlow: this.riddleFlow,
      resolveSubredditName: this.resolveSubredditName.bind(this),
    });
    this.eventFlow = createEventFlow({
      cleanupExpiredRiddles: this.riddleFlow.cleanupExpiredRiddles,
    });
  }

  // User Management
  async getUser(username: string): Promise<User | null> {
    return this.userFlow.getUser(username);
  }

  async createUser(username: string): Promise<User> {
    return this.userFlow.createUser(username);
  }

  async updateUserXp(username: string, xpGained: number): Promise<User> {
    return this.userFlow.updateUserXp(username, xpGained);
  }

  // Riddle Management
  async createRiddleFromTheme(params: CreateRiddleFromThemeParams): Promise<RiddleV2 | null> {
    return this.riddleFlow.createRiddleFromTheme(params);
  }

  async getRiddle(id: string): Promise<RiddleV2 | null> {
    return this.riddleFlow.getRiddle(id);
  }

  async submitAnswer(params: SubmitAnswerParams): Promise<SubmitAnswerResult> {
    return this.answerFlow.submitAnswer(params);
  }

  private async resolveSubredditName(explicit?: string): Promise<string> {
    if (explicit) {
      return explicit;
    }

    try {
      const raw = await this.redis.get('debattle:settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.subredditName && typeof parsed.subredditName === 'string') {
          return parsed.subredditName;
        }
      }
    } catch (err) {
      console.warn('[Service.resolveSubredditName] failed to parse cached settings', err);
    }

    try {
      return await this.reddit.getCurrentSubredditName();
    } catch (err) {
      console.error('[Service.resolveSubredditName] fallback to getCurrentSubredditName failed', err);
      throw new Error('Unable to determine subreddit name');
    }
  }

  async shareResponseToSubreddit(params: ShareResponseParams): Promise<ShareResponseResult> {
    return this.shareFlow.shareResponseToSubreddit(params);
  }

  // Utility Methods
  private async updateUserStats(username: string, stat: keyof User, increment: number): Promise<void> {
    await this.userFlow.updateUserStats(username, stat, increment);
  }
  
  async onEvent(event: { comment: { body: string; author: string; id: string }; post: { id: string } }, context: TriggerContext) {
    return this.eventFlow.onEvent(event, context);
  }

  async handleAppUpgrade(event: AppUpgrade, context: TriggerContext): Promise<void> {
    return this.eventFlow.handleAppUpgrade(event, context);
  }

  async getActiveRiddles(): Promise<string[]> {
    return this.riddleFlow.getActiveRiddles();
  }
}
