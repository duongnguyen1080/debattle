import { Devvit, SettingScope } from '@devvit/public-api';
import { Router } from './components/Router.js';
import { Service } from './services/Service.js';
import { installGame } from './mod-actions/installGame.js';
import { newPinnedPost } from './mod-actions/newPinnedPost.js';
import { topWeeklyDebattle } from './mod-actions/topWeeklyDebattle.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
  media: true,
});

// Declare settings so they appear in Devvit UI/CLI
// Use app-scoped secret as per Devvit docs.
Devvit.addSettings([
  {
    type: 'string',
    name: 'openaiApiKey',
    label: 'OpenAI API Key',
    isSecret: true,
    scope: SettingScope.App,
  },
  // Back-compat/fallbacks
  { type: 'string', name: 'OPENAI_API_KEY', label: 'OpenAI API Key (Legacy)', isSecret: true, scope: SettingScope.App },
  { type: 'string', name: 'OPENAI_MODEL', label: 'OpenAI Model (Legacy)', defaultValue: 'gpt-4o-mini', scope: SettingScope.App },
  { type: 'string', name: 'openaiModel', label: 'OpenAI Model', defaultValue: 'gpt-4o-mini', scope: SettingScope.App },
]);

// Add custom post types
Devvit.addCustomPostType({
  name: 'Install Game',
  height: 'tall',
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
      const service = new Service(
        context.redis,
        context.reddit,
        { getSetting: context.settings?.get?.bind(context.settings) }
      );
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
      const service = new Service(
        context.redis,
        context.reddit,
        { getSetting: context.settings?.get?.bind(context.settings) }
      );
      await service.handleAppUpgrade(event as any, context);
    } catch (e) {
      console.error('AppUpgrade trigger failed:', e);
    }
  },
});

export default Devvit;
