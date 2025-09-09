import type { MenuItem } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';

// Keep logic aligned with previous inline action (no sticky, same preview/fallback)
export const newPinnedPost: MenuItem = {
  label: 'Debattle: Create Pinned Hub',
  description: 'Publish the Debattle Community Hub (leaderboard, info, progress)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    try {
      const subredditName = await context.reddit.getCurrentSubredditName();
      await context.reddit.submitPost({
        subredditName,
        title: 'Debattle — Community Hub',
        preview: (
          <vstack height="100%" width="100%" alignment="middle center">
            <text size="large">🏛️ Debattle Hub — Loading…</text>
          </vstack>
        ),
        textFallback: { text: 'Debattle Community Hub — open in the Reddit app to view.' },
      });
      await context.ui.showToast('Created Debattle Community Hub');
    } catch (e) {
      console.error('Failed to create Pinned Hub:', e);
      await context.ui.showToast('Failed to create Pinned Hub');
    }
  },
};

export default newPinnedPost;
