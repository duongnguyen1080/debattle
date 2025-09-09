import { useState, useInterval, Devvit } from '@devvit/public-api';
import { Service } from '../services/Service.js';
import { User, LeaderboardEntry, LEVEL_TIERS } from '../types/index.js';

interface PinnedPostProps {
  context: any;
  currentUser: User | null;
  initialTab?: 'leaderboard' | 'info' | 'progress';
}

export function PinnedPost({ context, currentUser, initialTab }: PinnedPostProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [activeTab, setActiveTab] = useState<'leaderboard' | 'info' | 'progress'>(initialTab || 'leaderboard');
  
    const [loaded, setLoaded] = useState(false);
  
    const loadLeaderboard = async () => {
      const service = new Service(context.redis, context.reddit);
      const topUsers = await service.getLeaderboard(25);
      setLeaderboard(topUsers);
    };
  
    useInterval(async () => {
      if (!loaded) {
        await loadLeaderboard();
        setLoaded(true);
      }
    }, 100);

  const getCurrentUserRank = (): number => {
    if (!currentUser) return 0;
    const userEntry = leaderboard.find(entry => entry.username === currentUser.username);
    return userEntry ? userEntry.rank : 0;
  };

  const getNextLevelInfo = () => {
    if (!currentUser) return null;
    const nextTier = LEVEL_TIERS.find(t => t.level === currentUser.level + 1);
    if (!nextTier) return null;
    
    const xpNeeded = nextTier.minXp - currentUser.xp;
    return { nextTier, xpNeeded };
  };

  if (!loaded) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large">🏛️ Loading Community Hub...</text>
        <text size="medium">⏳ Loading...</text>
      </vstack>
    );
  }

  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">🏛️ Debattle Community Hub</text>
      <text size="large">Welcome to the ultimate riddle community!</text>

      {/* Tab Navigation */}
      <hstack gap="small" width="100%" maxWidth="400px">
        <button
          appearance={activeTab === 'leaderboard' ? 'primary' : 'secondary'}
          onPress={() => setActiveTab('leaderboard')}
          width="33%"
        >
          🏆 Leaderboard
        </button>
        <button
          appearance={activeTab === 'info' ? 'primary' : 'secondary'}
          onPress={() => setActiveTab('info')}
          width="33%"
        >
          ℹ️ How to Play
        </button>
        <button
          appearance={activeTab === 'progress' ? 'primary' : 'secondary'}
          onPress={() => setActiveTab('progress')}
          width="33%"
        >
          📊 Progress
        </button>
      </hstack>

      {/* Tab Content */}
      {activeTab === 'leaderboard' && (
        <vstack gap="medium" width="100%" maxWidth="600px">
          <text size="large" weight="bold">🏆 Top Players</text>
          
          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <hstack key={entry.username} gap="medium" width="100%" alignment="start">
                <text size="large" weight="bold">#{entry.rank}</text>
                <vstack gap="small" width="100%">
                  <hstack gap="small" alignment="center">
                    <text size="medium" weight="bold">{entry.username}</text>
                    <text size="small" color="secondary">{entry.flair}</text>
                  </hstack>
                  <text size="small" color="secondary">
                    Level {entry.level} • {entry.xp} XP
                  </text>
                </vstack>
              </hstack>
            ))
          ) : (
            <text size="medium" color="secondary">No players yet</text>
          )}
        </vstack>
      )}

      {activeTab === 'info' && (
        <vstack gap="medium" width="100%" maxWidth="600px">
          <text size="large" weight="bold">🎯 How to Play</text>
          
          <vstack gap="small" width="100%">
            <text size="medium" weight="bold">Creating Riddles:</text>
            <text size="small">• Choose a theme from 3 random options</text>
            <text size="small">• Write your riddle and answer within the time limit</text>
            <text size="small">• Earn points based on speed and quality</text>
            <text size="small">• Get +5 points for posting to the community</text>
          </vstack>

          <vstack gap="small" width="100%">
            <text size="medium" weight="bold">Solving Riddles:</text>
            <text size="small">• Reply with "!guess [your answer]" in comments</text>
            <text size="small">• Earn 5 points per 10 upvotes on your guess</text>
            <text size="small">• Get +5 bonus points for being first to solve</text>
            <text size="small">• Help others by upvoting good guesses</text>
          </vstack>

          <vstack gap="small" width="100%">
            <text size="medium" weight="bold">Leveling Up:</text>
            <text size="small">• XP = Points (1:1 ratio)</text>
            <text size="small">• Each level unlocks new community flairs</text>
            <text size="small">• Higher levels get bonus time for riddle creation</text>
            <text size="small">• Compete for the prestigious "Sage of Arete" title</text>
          </vstack>
        </vstack>
      )}

      {activeTab === 'progress' && currentUser && (
        <vstack gap="medium" width="100%" maxWidth="600px">
          <text size="large" weight="bold">📊 Your Progress</text>
          
          <vstack gap="medium" width="100%" padding="medium" backgroundColor="neutral">
            <hstack gap="large" width="100%" alignment="center">
              <vstack alignment="center">
                <text size="large" weight="bold">{currentUser.level}</text>
                <text size="small">Current Level</text>
              </vstack>
              <vstack alignment="center">
                <text size="large" weight="bold">{currentUser.xp}</text>
                <text size="small">Total XP</text>
              </vstack>
              <vstack alignment="center">
                <text size="large" weight="bold">{getCurrentUserRank() || 'Unranked'}</text>
                <text size="small">Leaderboard Rank</text>
              </vstack>
            </hstack>
            
            <text size="medium" weight="bold" alignment="center">
              {currentUser.flair}
            </text>
          </vstack>

          <vstack gap="small" width="100%">
            <text size="medium" weight="bold">Stats:</text>
            <text size="small">• Riddles Created: {currentUser.riddlesCreated}</text>
            <text size="small">• Riddles Solved: {currentUser.riddlesSolved}</text>
            <text size="small">• Total Upvotes: {currentUser.totalUpvotes}</text>
            <text size="small">• Member Since: {new Date(currentUser.joinDate).toLocaleDateString()}</text>
          </vstack>

          {(() => {
            const nextLevel = getNextLevelInfo();
            if (nextLevel) {
              return (
                <vstack gap="small" width="100%" padding="medium" backgroundColor="neutral">
                  <text size="medium" weight="bold">Next Level: {nextLevel.nextTier.level}</text>
                  <text size="small">{nextLevel.nextTier.flair}</text>
                  <text size="small">{nextLevel.nextTier.notes}</text>
                  <text size="small" color="secondary">
                    {nextLevel.xpNeeded} XP needed to level up
                  </text>
                </vstack>
              );
            }
            return (
              <vstack gap="small" width="100%" padding="medium" backgroundColor="neutral">
                <text size="medium" weight="bold">🏆 Maximum Level Reached!</text>
                <text size="small">You are a {currentUser.flair}</text>
                <text size="small">Keep playing to maintain your status!</text>
              </vstack>
            );
          })()}
        </vstack>
      )}

      {!currentUser && activeTab === 'progress' && (
        <vstack gap="medium" width="100%" maxWidth="600px">
          <text size="large" weight="bold">📊 Progress</text>
          <text size="medium" color="secondary">Sign in to view your progress</text>
        </vstack>
      )}

      <text size="small" color="secondary" alignment="center">
        🎯 Ready to create or solve riddles? Use the menu above to get started!
      </text>
    </vstack>
  );
}
