import { useState, useInterval, Devvit } from '@devvit/public-api';
import { Service } from '../services/Service.js';
import { User, RiddleV2, LeaderboardEntry } from '../types/index.js';

interface CollectionPostProps {
  context: any;
  currentUser: User | null;
}

export function CollectionPost({ context, currentUser }: CollectionPostProps) {
  const [topRiddles, setTopRiddles] = useState<RiddleV2[]>([]);
  const [topSolvers, setTopSolvers] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const loadCollectionData = async () => {
    try {
      setIsLoading(true);
      const service = new Service(context.redis, context.reddit);
      
      // Get top riddles (simplified - in real implementation, you'd query by week)
      const activeRiddles = await service.getActiveRiddles();
      const riddles: RiddleV2[] = [];
      
      for (const riddleId of activeRiddles.slice(0, 5)) {
        const riddle = await service.getRiddle(riddleId);
        if (riddle) riddles.push(riddle);
      }
      setTopRiddles(riddles);
      
      // Get top solvers
      const leaderboard = await service.getLeaderboard(10);
      setTopSolvers(leaderboard);
      
    } catch (error) {
      console.error('Failed to load collection data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // one-shot load on mount
  useInterval(async () => {
    if (!loaded) {
      await loadCollectionData();
      setLoaded(true);
    }
  }, 100);

  if (isLoading) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large">🏆 Loading Weekly Collection...</text>
        <text size="large">🏆 Loading Weekly Collection...</text>
        <text size="medium">⏳ Loading...</text>
      </vstack>
    );
  }

  return (
    <vstack height="100%" width="100%" alignment="middle center" gap="large" padding="large">
      <text size="xlarge">🏆 Weekly Riddle Collection</text>
      <text size="large">Top riddles and solvers of the week</text>

      <vstack gap="large" width="100%" maxWidth="600px">
        {/* Top Riddles Section */}
        <vstack gap="medium" width="100%">
          <text size="large" weight="bold">🔥 Top Riddles</text>
          
          {topRiddles.length > 0 ? (
            topRiddles.map((riddle, index) => (
              <vstack key={riddle.id} gap="small" width="100%" padding="medium" backgroundColor="neutral">
                <hstack gap="medium" width="100%" alignment="start">
                  <text size="large" weight="bold">#{index + 1}</text>
                  <vstack gap="small" width="100%">
                    <text size="medium" weight="bold">Theme: {riddle.meta.theme}</text>
                    <text size="medium">{riddle.meta.riddleText}</text>
                    <text size="small" color="secondary">by {riddle.authorUsername} • {riddle.responses.length} responses</text>
                  </vstack>
                </hstack>
              </vstack>
            ))
          ) : (
            <text size="medium" color="secondary">No riddles available yet</text>
          )}
        </vstack>

        {/* Top Solvers Section */}
        <vstack gap="medium" width="100%">
          <text size="large" weight="bold">👑 Top Solvers</text>
          
          {topSolvers.length > 0 ? (
            topSolvers.map((solver, index) => (
              <hstack key={solver.username} gap="medium" width="100%" alignment="start">
                <text size="large" weight="bold">#{solver.rank}</text>
                <vstack gap="small" width="100%">
                  <hstack gap="small" alignment="center">
                    <text size="medium" weight="bold">{solver.username}</text>
                    <text size="small" color="secondary">{solver.flair}</text>
                  </hstack>
                  <text size="small" color="secondary">
                    Level {solver.level} • {solver.xp} XP
                  </text>
                </vstack>
              </hstack>
            ))
          ) : (
            <text size="medium" color="secondary">No solvers yet</text>
          )}
        </vstack>

        {/* Current User Stats */}
        {currentUser && (
          <vstack gap="medium" width="100%" padding="medium" backgroundColor="neutral">
            <text size="large" weight="bold">Your Stats</text>
            <hstack gap="large" width="100%" alignment="center">
              <vstack alignment="center">
                <text size="large" weight="bold">{currentUser.level}</text>
                <text size="small">Level</text>
              </vstack>
              <vstack alignment="center">
                <text size="large" weight="bold">{currentUser.xp}</text>
                <text size="small">XP</text>
              </vstack>
              <vstack alignment="center">
                <text size="large" weight="bold">{currentUser.riddlesCreated}</text>
                <text size="small">Created</text>
              </vstack>
              <vstack alignment="center">
                <text size="large" weight="bold">{currentUser.riddlesSolved}</text>
                <text size="small">Solved</text>
              </vstack>
            </hstack>
            <text size="small" color="secondary" alignment="center">
              {currentUser.flair}
            </text>
          </vstack>
        )}
      </vstack>

      <text size="small" color="secondary" alignment="center">
        📅 Collection updates every week • Keep solving to climb the ranks!
      </text>
    </vstack>
  );
}
