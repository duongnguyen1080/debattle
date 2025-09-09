import type { MenuItem } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';

// Placeholder: to be implemented later
export const topWeeklyDebattle: MenuItem = {
  label: 'Debattle: Top Weekly Debattle',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    await context.ui.showToast('Top Weekly Debattle is coming soon');
  },
};

export default topWeeklyDebattle;

