import type { Service } from '../services/Service.js';
import type { User } from '../types/index.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function resolveUsername(context: any): Promise<string | null> {
  const explicit = typeof context?.username === 'string' ? context.username.trim() : '';
  if (explicit) return explicit;

  const userId: string | undefined = context?.userId;
  if (!userId) return null;

  const cacheKey = `cache:userId-username:${userId}`;
  let username = (await context.redis.get(cacheKey)) || null;
  if (username) return username;

  const legacyKey = 'cache:userId-username';
  const legacy = await context.redis.hGet?.(legacyKey, userId);
  if (legacy) {
    await context.redis.set(cacheKey, legacy, { expiration: new Date(Date.now() + THIRTY_DAYS_MS) });
    return legacy;
  }

  try {
    const user = await context.reddit.getUserById(userId);
    if (user?.username) {
      await context.redis.set(cacheKey, user.username, { expiration: new Date(Date.now() + THIRTY_DAYS_MS) });
      return user.username;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export async function hydrateCurrentUser(
  context: any,
  service: Service
): Promise<{ currentUser: User | null; username: string }>
{
  const resolved = (await resolveUsername(context)) || 'anonymous';

  let currentUser: User | null = await service.getUser(resolved);
  if (!currentUser) {
    currentUser = await service.createUser(resolved);
  }

  return { currentUser, username: resolved };
}
