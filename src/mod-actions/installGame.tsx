import type { MenuItem } from '@devvit/public-api';
import { Devvit } from '@devvit/public-api';

const DEFAULT_INSTALL_TITLE = 'Debattle — Community Hub';

const installGameForm = Devvit.createForm(
  {
    title: 'Install Debattle',
    acceptLabel: 'Create Post',
    fields: [
      {
        type: 'string',
        name: 'title',
        label: 'Post title',
        required: true,
        defaultValue: DEFAULT_INSTALL_TITLE,
        helpText: 'This is the title for the pinned Debattle post.',
      },
    ],
  },
  async (event, context) => {
    const { ui, reddit, redis } = context;
    try {
      const community = await reddit.getCurrentSubreddit();
      const title = event.values.title?.trim() || DEFAULT_INSTALL_TITLE;
      console.log('[InstallGame] subreddit', { name: community?.name, title });

      const preview = (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Debattle</text>
          <text size="small">Loading the community hub...</text>
        </vstack>
      );

      // Create a Web custom post so the web client is the default experience.
      const post = await reddit.submitPost({
        subredditName: community.name,
        title,
        preview,
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
  }
);

export const installGame: MenuItem = {
  label: 'Install game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    context.ui.showForm(installGameForm);
  },
};

export default installGame;
