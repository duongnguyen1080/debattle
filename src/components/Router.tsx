import { Devvit, useAsync, useState } from '@devvit/public-api';

import { PinnedPost } from './PinnedPost.js';
import { SplashScreen } from './SplashScreen.js';
import { HomeScreen } from './home/HomeScreen.js';
import { RoundV2Flow } from './home/RoundV2Flow.js';

import { Service } from '../services/Service.js';
import type { User } from '../types/index.js';
import { hydrateCurrentUser } from '../utils/user.js';

interface RouterProps {
  context: any;
  postType?: 'riddle' | 'pinned';
  initialView?: 'home' | 'play' | 'leaderboard' | 'info' | 'progress';
}

export function Router({ context, postType, initialView }: RouterProps) {
  console.log('[Router] render', { postType, initialView });

  const normalizedPostType = postType ?? 'pinned';

  let resolvedInitialView = initialView;
  if (normalizedPostType === 'pinned') {
    console.log('[Router] pinned route: forcing home flow');
    resolvedInitialView = 'home';
  }

  return <HomeFlow context={context} initialView={resolvedInitialView} />;
}

type ViewState = 'home' | 'play' | 'leaderboard' | 'info' | 'progress';

interface HomeFlowProps {
  context: any;
  initialView?: ViewState;
}

interface HomeSession {
  currentUser: User | null;
  username: string;
}

function HomeFlow({ context, initialView }: HomeFlowProps) {
  const initialViewState: ViewState = (initialView || 'home') as ViewState;
  const [view, setView] = useState<ViewState>(initialViewState);
  const [session, setSession] = useState<HomeSession | null>(null);

useAsync(
  async () => {
    if (session) {
      return session;
    }

      try {
        const service = new Service(
          context.redis,
          context.reddit,
          { getSetting: context.settings?.get?.bind(context.settings) }
        );

        return await hydrateCurrentUser(context, service);
      } catch (error) {
        console.error('[HomeFlow] failed to hydrate user', error);
        return { currentUser: null, username: 'anonymous' } as HomeSession;
      }
    },
    {
      depends: [session ? 'ready' : 'pending'],
      finally: result => {
        if (session || !result) {
          return;
        }

        setSession(result);
      },
    }
  );

  if (!session) {
    return <SplashScreen />;
  }

  const currentUser = session.currentUser;

  const views: Record<ViewState, JSX.Element> = {
    home: (
      <HomeScreen
        currentUser={currentUser}
        onStart={() => setView('play')}
        onLeaderboard={() => setView('leaderboard')}
        onHowToPlay={() => setView('info')}
        onProgress={() => setView('progress')}
      />
    ),
    play: (
      <RoundV2Flow
        context={context}
        currentUser={currentUser}
        onExit={() => setView('home')}
      />
    ),
    leaderboard: <PinnedPost context={context} currentUser={currentUser} initialTab="leaderboard" />,
    info: <PinnedPost context={context} currentUser={currentUser} initialTab="info" />,
    progress: <PinnedPost context={context} currentUser={currentUser} initialTab="progress" />,
  };

  return views[view] ?? (
    <vstack height="100%" width="100%" alignment="middle center">
      <text>Unknown view</text>
    </vstack>
  );
}
