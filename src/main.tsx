import { Devvit } from '@devvit/public-api';
import { Router } from './components/Router.js';
import { Service } from './services/Service.js';
import { installGame } from './mod-actions/installGame.js';
import { newPinnedPost } from './mod-actions/newPinnedPost.js';
import { topWeeklyDebattle } from './mod-actions/topWeeklyDebattle.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add custom post types
Devvit.addCustomPostType({
  name: 'Riddle Post',
  height: 'regular',
  render: (context) => {
    return <Router context={context} initialView="home" />;
  },
});

Devvit.addCustomPostType({
  name: 'Collection Post',
  height: 'regular',
  render: (context) => {
    return <Router context={context} initialView="collection" />;
  },
});

Devvit.addCustomPostType({
  name: 'Pinned Post',
  height: 'regular',
  render: (context) => {
    return <Router context={context} postType="pinned" initialView="home" />;
  },
});

// Moderator menu items (separated files)
Devvit.addMenuItem(installGame);
Devvit.addMenuItem(newPinnedPost);
Devvit.addMenuItem(topWeeklyDebattle);

// Backend triggers
Devvit.addTrigger({
  event: 'CommentCreate',
  onEvent: async (event, context) => {
    try {
      const service = new Service(context.redis, context.reddit);
      await service.onEvent(event as any, context);
    } catch (e) {
      console.error('CommentCreate trigger failed:', e);
    }
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (event, context) => {
    try {
      const service = new Service(context.redis, context.reddit);
      await service.handleAppUpgrade(event as any, context);
    } catch (e) {
      console.error('AppUpgrade trigger failed:', e);
    }
  },
});

export default Devvit;
