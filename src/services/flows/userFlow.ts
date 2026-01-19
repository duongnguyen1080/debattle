import { RedisClient, RedditAPIClient } from '@devvit/public-api';
import type { User } from '../../types/index.js';
import { calculateLevel, getFlairForLevel } from '../../utils/gameUtils.js';

export interface UserFlow {
  getUser(username: string): Promise<User | null>;
  createUser(username: string): Promise<User>;
  updateUserXp(username: string, xpGained: number): Promise<User>;
  updateUserStats(username: string, stat: keyof User, increment: number): Promise<void>;
}

export function createUserFlow(deps: {
  redis: RedisClient;
  reddit: RedditAPIClient;
  resolveSubredditName: (explicit?: string) => Promise<string>;
}): UserFlow {
  const { redis, reddit, resolveSubredditName } = deps;

  const formatUserFlairText = (level: number, flair: string): string => {
    return `Level ${level} - ${flair}`.replace(/\s+/g, ' ').trim();
  };

  const syncUserFlair = async (username: string, user: User): Promise<void> => {
    const sanitizedUsername = (username || '').replace(/^u\//i, '').trim();
    if (!sanitizedUsername) {
      return;
    }

    try {
      const subredditName = await resolveSubredditName();
      await reddit.setUserFlair({
        subredditName,
        username: sanitizedUsername,
        text: formatUserFlairText(user.level, user.flair),
      });
    } catch (err) {
      console.warn('[UserFlow.syncUserFlair] failed', { username: sanitizedUsername, level: user.level }, err);
    }
  };

  const handleUserLevelUp = async (username: string, user: User): Promise<void> => {
    try {
      await reddit.sendPrivateMessage({
        to: username,
        subject: `\uD83C\uDF89 Level Up! You're now a ${user.flair}!`,
        text: `Congratulations! You've reached level ${user.level} and earned the title: ${user.flair}\n\nKeep creating and solving riddles to reach even higher levels!`,
      });
    } catch (error) {
      console.error('Failed to send level up message:', error);
    }
  };

  const getUser = async (username: string): Promise<User | null> => {
    const raw = await redis.hGet('users', username);
    if (!raw) return null;
    try {
      const user: User = JSON.parse(raw);
      user.level = calculateLevel(user.xp);
      user.flair = getFlairForLevel(user.level);
      return user;
    } catch {
      return null;
    }
  };

  const createUser = async (username: string): Promise<User> => {
    const user: User = {
      username,
      xp: 0,
      level: 1,
      flair: '\uD83C\uDF31 Novice Debattler',
      riddlesCreated: 0,
      riddlesSolved: 0,
      totalUpvotes: 0,
      joinDate: Date.now(),
    };

    await redis.hSet('users', { [username]: JSON.stringify(user) });
    return user;
  };

  const updateUserXp = async (username: string, xpGained: number): Promise<User> => {
    let user = await getUser(username);
    const isNewUser = !user;
    if (!user) {
      user = await createUser(username);
    }

    const oldLevel = user.level;
    const oldFlair = user.flair;
    user.xp += xpGained;
    user.level = calculateLevel(user.xp);
    user.flair = getFlairForLevel(user.level);

    await redis.hSet('users', { [username]: JSON.stringify(user) });

    if (user.level > oldLevel) {
      await handleUserLevelUp(username, user);
    }

    if (isNewUser || user.flair !== oldFlair) {
      await syncUserFlair(username, user);
    }

    return user;
  };

  const updateUserStats = async (username: string, stat: keyof User, increment: number): Promise<void> => {
    const user = await getUser(username);
    if (!user) return;

    if (typeof user[stat] === 'number') {
      (user as any)[stat] += increment;
      await redis.hSet('users', { [username]: JSON.stringify(user) });
    }
  };

  return {
    getUser,
    createUser,
    updateUserXp,
    updateUserStats,
  };
}
