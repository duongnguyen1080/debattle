import { Devvit, SettingScope } from '@devvit/public-api';
import { Service } from './services/Service.js';
import { installGame } from './mod-actions/installGame.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
  media: true,
  userActions: true,
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
  {
    type: 'string',
    name: 'supabaseUrl',
    label: 'Supabase URL',
    defaultValue: 'https://dlukhaogmdtzopmbehvt.supabase.co',
    scope: SettingScope.App,
  },
  {
    type: 'string',
    name: 'supabaseServiceRoleKey',
    label: 'Supabase Service Role Key',
    isSecret: true,
    scope: SettingScope.App,
  },
  { type: 'string', name: 'SUPABASE_URL', label: 'Supabase URL (Legacy)', scope: SettingScope.App },
  {
    type: 'string',
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase Service Role Key (Legacy)',
    isSecret: true,
    scope: SettingScope.App,
  },
]);

// Web custom post entrypoints live in devvit.json (post.entrypoints).

// Moderator menu items (separated files)
Devvit.addMenuItem(installGame);

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
