import { RedisClient } from '@devvit/public-api';
import { RiddleV2 } from '../../types/index.js';
import { getRandomQuestion } from '../../utils/questionBank.js';
import type { QuestionBankEntry } from '../../utils/questionBank.js';

export interface CreateRiddleFromThemeParams {
  theme: string;
  playerUsername: string;
  question?: QuestionBankEntry;
}

export interface RiddleFlow {
  createRiddleFromTheme(params: CreateRiddleFromThemeParams): Promise<RiddleV2 | null>;
  getRiddle(id: string): Promise<RiddleV2 | null>;
  getActiveRiddles(): Promise<string[]>;
  cleanupExpiredRiddles(): Promise<void>;
  saveRiddle(riddle: RiddleV2): Promise<void>;
}

export function createRiddleFlow(deps: { redis: RedisClient }): RiddleFlow {
  const { redis } = deps;

  const riddleKey = (id: string): string => (id.startsWith('riddle:') ? id : `riddle:${id}`);

  const saveRiddle = async (riddle: RiddleV2): Promise<void> => {
    await redis.set(riddleKey(riddle.id), JSON.stringify(riddle));
  };

  const getRiddle = async (id: string): Promise<RiddleV2 | null> => {
    const raw = await redis.get(riddleKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RiddleV2;
    } catch {
      return null;
    }
  };

  const getActiveRiddles = async (): Promise<string[]> => {
    const activeRiddles = await redis.get('riddles:active');
    if (!activeRiddles) return [];
    try {
      return JSON.parse(activeRiddles);
    } catch {
      return [];
    }
  };

  const createRiddleFromTheme = async (
    params: CreateRiddleFromThemeParams
  ): Promise<RiddleV2 | null> => {
    const { theme: requestedTheme, playerUsername, question: providedQuestion } = params;
    console.log('[RiddleFlow.createRiddleFromTheme] start', { requestedTheme, playerUsername });
    try {
      // Use a bare id for the model id; Redis keys will be prefixed via riddleKey().
      const id = `${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
      const now = Date.now();
      const expiresAt = now + 24 * 60 * 60 * 1000; // 24h
      const question = providedQuestion ?? getRandomQuestion();
      const riddleText =
        question.question ||
        `On the theme of ${question.theme}: What do you owe to yourself that cannot be owned?`;

      const riddle: RiddleV2 = {
        id,
        meta: {
          theme: question.theme,
          riddleText,
          questionId: question.id,
          requestedTheme,
        },
        authorUsername: playerUsername,
        createdAt: now,
        expiresAt,
        status: 'active',
        responses: [],
      };

      console.log('[RiddleFlow.createRiddleFromTheme] persisting');
      await saveRiddle(riddle);
      const active = await getActiveRiddles();
      const next = Array.isArray(active) ? [...active, id] : [id];
      await redis.set('riddles:active', JSON.stringify(next));
      console.log('[RiddleFlow.createRiddleFromTheme] done', { id });
      return riddle;
    } catch (e) {
      console.error('[RiddleFlow.createRiddleFromTheme] error', e);
      return null;
    }
  };

  const cleanupExpiredRiddles = async (): Promise<void> => {
    const activeIds = await getActiveRiddles();
    if (activeIds.length === 0) return;

    const now = Date.now();
    const remaining: string[] = [];

    for (const rid of activeIds) {
      const riddle = await getRiddle(rid);
      if (!riddle) continue;
      if (riddle.expiresAt < now) {
        riddle.status = 'archived';
        await saveRiddle(riddle);
      } else {
        remaining.push(rid);
      }
    }

    await redis.set('riddles:active', JSON.stringify(remaining));
  };

  return {
    createRiddleFromTheme,
    getRiddle,
    getActiveRiddles,
    cleanupExpiredRiddles,
    saveRiddle,
  };
}
