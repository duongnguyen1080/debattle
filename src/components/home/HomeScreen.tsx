import { Devvit } from '@devvit/public-api';
import { User } from '../../types/index.js';

interface HomeScreenProps {
  currentUser: User | null;
  onStart: () => void;
  onLeaderboard: () => void;
  onHowToPlay: () => void;
  onCollection: () => void;
  onProgress: () => void;
}

export function HomeScreen({ currentUser, onStart, onLeaderboard, onHowToPlay, onCollection, onProgress }: HomeScreenProps) {
  console.log('[HomeScreen] render', { hasUser: !!currentUser, level: currentUser?.level, flair: currentUser?.flair });
  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">🏛️ Debattle</text>
      <text size="large">Philosophical riddles, crafted and judged by Arete</text>

      <vstack gap="small" width="100%" maxWidth="420px">
        {console.log('[HomeScreen] buttons rendered')}
        <button appearance="primary" width="100%" onPress={() => { console.log('[HomeScreen] onStart clicked'); onStart(); }}>🎯 Start Round</button>
        <button appearance="secondary" width="100%" onPress={() => { console.log('[HomeScreen] onLeaderboard clicked'); onLeaderboard(); }}>🏆 Leaderboard</button>
        <button appearance="secondary" width="100%" onPress={() => { console.log('[HomeScreen] onCollection clicked'); onCollection(); }}>📚 Weekly Collection</button>
        <button appearance="secondary" width="100%" onPress={() => { console.log('[HomeScreen] onHowToPlay clicked'); onHowToPlay(); }}>ℹ️ How to Play</button>
      </vstack>

      {currentUser && (
        <vstack gap="small" width="100%" maxWidth="420px" padding="medium">
          <text size="medium" weight="bold" alignment="center">Level {currentUser.level} • {currentUser.flair}</text>
          <button appearance="secondary" width="100%" onPress={onProgress}>📊 View Your Progress</button>
        </vstack>
      )}

      {!currentUser && (
        <text size="small" color="secondary">Sign in to track your progress</text>
      )}
    </vstack>
  );
}
