import type { MenuItem } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';

export const installGame: MenuItem = {
  label: 'Install game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { ui, reddit, redis } = context;
    try {
      const community = await reddit.getCurrentSubreddit();
      console.log('[InstallGame] subreddit', { name: community?.name });

      // Create a Web custom post so the web client is the default experience.
      const post = await reddit.submitCustomPost({
        subredditName: community.name,
        title: 'Debattle — Community Hub',
        entry: 'default',
        textFallback: { text: 'Debattle Community Hub — open in the Reddit app to view.' },
      });
      console.log('[InstallGame] post created', { id: post?.id, url: (post as any)?.url });

      // Pin the post and store basic install metadata
      await Promise.all([
        post.sticky(),
        redis.set('debattle:pinnedPostId', post.id),
        redis.set('debattle:settings', JSON.stringify({ subredditName: community.name })),
      ]);
      console.log('[InstallGame] post pinned and settings saved');

      // Navigate and notify
      if (ui.navigateTo) {
        console.log('[InstallGame] navigating to post');
        ui.navigateTo(post as any);
      } else {
        console.log('[InstallGame] ui.navigateTo not available');
      }
      await ui.showToast('Installed Debattle!');
    } catch (e) {
      console.error('Failed to install Debattle:', e);
      await context.ui.showToast('Failed to install Debattle');
    }
  },
};

export default installGame;
