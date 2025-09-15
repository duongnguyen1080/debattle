import { Devvit, useState } from '@devvit/public-api';
import { CollectionPost } from './CollectionPost.js';
import { PinnedPost } from './PinnedPost.js';
import { Service } from '../services/Service.js';
import { User } from '../types/index.js';
import { HomeScreen } from './home/HomeScreen.js';
import { RoundV2Flow } from './home/RoundV2Flow.js';

interface RouterProps {
  context: any;
  postType?: 'riddle' | 'collection' | 'pinned';
  initialView?: 'home' | 'play' | 'collection' | 'leaderboard' | 'info' | 'progress';
}

export function Router({ context, postType, initialView }: RouterProps) {
  const service = new Service(context.redis, context.reddit);
  console.log('[Router] render', { postType, initialView });

  // Resolve username with Redis cache (userId → username), then hydrate the user once.
  const [data] = useState<{ currentUser: User | null; username: string | null }>(
    async () => {
      const userId: string | undefined = (context as any)?.userId;
      console.log('[Router] resolve user: start', { hasUserId: !!userId });

      // Look up username with a cache to avoid repeated Reddit API calls.
      const ttlMs = 30 * 24 * 60 * 60 * 1000; // 30 days
      let username: string | null = null;
      if (userId) {
        const cacheKey = `cache:userId-username:${userId}`;
        const oldCacheKey = 'cache:userId-username';

        username = (await context.redis.get(cacheKey)) || null;
        if (username) console.log('[Router] resolve user: cache hit', { cacheKey, username });
        if (!username) {
          const legacy = await context.redis.hGet(oldCacheKey, userId);
          if (legacy) {
            username = legacy;
            await context.redis.set(cacheKey, username, { expiration: new Date(Date.now() + ttlMs) });
          }
        }

        if (!username) {
          try {
            const user = await context.reddit.getUserById(userId);
            if (user?.username) {
              username = user.username;
              await context.redis.set(cacheKey, username, { expiration: new Date(Date.now() + ttlMs) });
              console.log('[Router] resolve user: fetched by id', { username });
            }
          } catch {
            // ignore lookup failure
          }
        }
      }

      if (!username) {
        // Last‑resort fallbacks for other API shapes
        try {
          const me: any = await (context.reddit?.getCurrentUser?.());
          if (typeof me === 'string' && me) username = me;
          else if (me && typeof me === 'object') username = me.username || me.name || null;
          if (username) console.log('[Router] resolve user: fallback currentUser', { username });
        } catch {
          /* noop */
        }
      }

      if (!username) {
        username = 'anonymous';
        console.log('[Router] resolve user: defaulting to anonymous');
      }

      let currentUser = await service.getUser(username);
      if (!currentUser) {
        console.log('[Router] currentUser: not found, creating', { username });
        currentUser = await service.createUser(username);
      }
      console.log('[Router] currentUser: ready', { username, xp: currentUser?.xp, level: currentUser?.level });

      return { currentUser, username };
    }
  );

  const [view, setView] = useState<
    'home' | 'play' | 'collection' | 'leaderboard' | 'info' | 'progress'
  >(initialView || 'home');

  // For post types that don't require user data to render, route directly.
  if (postType === 'collection') {
    console.log('[Router] route: collection post');
    return <CollectionPost context={context} currentUser={data?.currentUser ?? null} />;
  }
  // Note: do not short-circuit pinned here; allow HomeScreen (Start) to render

  // Player-facing router
  switch (view) {
    case 'home':
      return (
        <HomeScreen
          currentUser={data?.currentUser ?? null}
          onStart={() => setView('play')}
          onLeaderboard={() => setView('leaderboard')}
          onHowToPlay={() => setView('info')}
          onCollection={() => setView('collection')}
          onProgress={() => setView('progress')}
        />
      );
    case 'play':
      // New V2 flow entry (theme → AI riddle → answer)
      return (
        <RoundV2Flow
          context={context}
          currentUser={data?.currentUser ?? null}
          onExit={() => setView('home')}
        />
      );
    case 'collection':
      return <CollectionPost context={context} currentUser={data?.currentUser ?? null} />;
    case 'leaderboard':
      return <PinnedPost context={context} currentUser={data?.currentUser ?? null} initialTab="leaderboard" />;
    case 'info':
      return <PinnedPost context={context} currentUser={data?.currentUser ?? null} initialTab="info" />;
    case 'progress':
      return <PinnedPost context={context} currentUser={data?.currentUser ?? null} initialTab="progress" />;
    default:
      return (
        <vstack height="100%" width="100%" alignment="middle center">
          <text>Unknown view</text>
        </vstack>
      );
  }
}
