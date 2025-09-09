import { Devvit, useState, useInterval } from '@devvit/public-api';
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
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [initialized, setInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<
      'home' | 'play' | 'collection' | 'leaderboard' | 'info' | 'progress'
    >(initialView || 'home');

    useInterval(async () => {
        if (!initialized) {
          await initializeUser();
          setInitialized(true);
        }
      }, 100);

  const initializeUser = async () => {
    try {
      setIsLoading(true);
      const service = new Service(context.redis, context.reddit);
      const username = context.reddit.getCurrentUser?.() || 'anonymous';
      
      let user = await service.getUser(username);
      if (!user) {
        user = await service.createUser(username);
      }
      
      setCurrentUser(user);
    } catch (err) {
      setError('Failed to initialize user');
      console.error('Router initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large">🎯 Loading Debattle...</text>
        <text size="medium">⏳ Loading...</text>
      </vstack>
    );
  }

  if (error) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large" color="red">❌ Error</text>
        <text>{error}</text>
        <button appearance="primary" onPress={initializeUser}>
          Retry
        </button>
      </vstack>
    );
  }

  // If a specific post type was requested, show an appropriate view
  if (postType === 'collection') {
    return <CollectionPost context={context} currentUser={currentUser} />;
  }
  if (postType === 'pinned') {
    return <PinnedPost context={context} currentUser={currentUser} />;
  }

  // Player-facing router
  switch (view) {
    case 'home':
      return (
        <HomeScreen
          currentUser={currentUser}
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
          currentUser={currentUser}
          onExit={() => setView('home')}
        />
      );
    case 'collection':
      return <CollectionPost context={context} currentUser={currentUser} />;
    case 'leaderboard':
      return <PinnedPost context={context} currentUser={currentUser} initialTab="leaderboard" />;
    case 'info':
      return <PinnedPost context={context} currentUser={currentUser} initialTab="info" />;
    case 'progress':
      return <PinnedPost context={context} currentUser={currentUser} initialTab="progress" />;
    default:
      return (
        <vstack height="100%" width="100%" alignment="middle center">
          <text>Unknown view</text>
        </vstack>
      );
  }
}
