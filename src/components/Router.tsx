import { Devvit, useAsync, useState } from '@devvit/public-api';

import { HomeScreen } from './home/HomeScreen.js';
import { RoundV2Flow } from './home/RoundV2Flow.js';
import { AchievementsScreen } from './home/AchievementsScreen.js';

import { Service } from '../services/Service.js';
import type { User } from '../types/index.js';
import { hydrateCurrentUser } from '../utils/user.js';

interface RouterProps {
  context: any;
  postType?: 'riddle' | 'pinned';
  initialView?: 'home' | 'play' | 'progress';
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

type ViewState = 'home' | 'play' | 'progress';

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

  const currentUser = session?.currentUser ?? null;

  const views: Record<ViewState, JSX.Element> = {
    home: (
      <HomeScreen
        currentUser={currentUser}
        onStart={() => setView('play')}
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
    progress: (
      <AchievementsScreen
        currentUser={currentUser}
        onBack={() => setView('home')}
        viewportHeight={context?.viewportHeight ?? 1024}
      />
    ),
  };

  if (!session) {
    return views.home;
  }

  return views[view] ?? (
    <vstack height="100%" width="100%" alignment="middle center">
      <text>Unknown view</text>
    </vstack>
  );
}
