# Debattle System Architecture

## Overview
- Devvit app with Devvit Web client + server; Blocks entry is minimal for triggers and mod actions.
- Web UI lives in `src/client` (React + `@devvit/web/client`); server endpoints in `src/server` call `src/services/Service.ts`.
- Redis is the sole state store; Reddit API is used for posting and user lookups.

## Platform setup
- Settings (App scope): `openaiApiKey`/`OPENAI_API_KEY`, `openaiModel`/`OPENAI_MODEL`, `supabaseUrl`/`supabaseServiceRoleKey`.
- Web custom post entrypoints are defined in `devvit.json` (`post.entrypoints.default` and optional `game`).
- Moderator menu item:
  - `Install game` submits a web custom post, pins it, and caches subreddit metadata in Redis.
- Triggers registered in `src/main.tsx`:
  - `CommentCreate` → `Service.onEvent` for legacy comment commands.
  - `AppUpgrade` → `Service.handleAppUpgrade` to clean expired riddles.
- Blocks UI has been removed; remaining Blocks usage is only for menu items and triggers.

## Frontend flows (Devvit Web UI)
- Entry point `src/client/App.tsx`:
  - Launch screen when inline; uses `requestExpandedMode` to move into the gameplay entrypoint.
  - Loads current user via `/api/user/current`.
- Home → Answer → Result → Achievements flow.
- Share action posts via `/api/share` and navigates to the created post.

## Backend services (`src/services/Service.ts`)
- User management:
  - Users stored as JSON in Redis hash `users`; create/hydrate as needed.
  - `updateUserXp` recalculates level/flair and sends a Reddit PM on level up.
- Riddle lifecycle:
  - `createRiddleFromTheme` creates a `RiddleV2`, stores `riddle:{id}`, tracks active IDs in `riddles:active` (24h expiry).
  - Cleanup of expired riddles runs on `AppUpgrade`.
- Answer evaluation (`submitAnswer`):
  - Heuristic scoring + optional AI grading via OpenAI.
  - Persists response, updates XP, returns feedback/decision/Arete data.
- Sharing to subreddit (`shareResponseToSubreddit`):
  - Posts a user-authored self-post via `reddit.submitPost`.
  - Stores `postId`/permalink on the response in Redis.
- Legacy comment commands (`onEvent` on `CommentCreate`):
  - `!answer <elapsed_ms> | <text>` scores and replies.
  - `!guess <text>` stores a reflection.

## Data model & persistence (Redis)
- `users` (hash): `{ username: User JSON }` with xp/level/flair/stats.
- `riddle:{id}` (string): `RiddleV2` containing meta (theme/questionId/text), author, timestamps, status, and `responses: PlayerResponse[]`.
- `riddles:active` (stringified array): active riddle IDs for expiry cleanup.
- `riddle:{id}:guesses` (stringified array): legacy guesses/reflections.
- `debattle:pinnedPostId`, `debattle:settings` (subredditName cache) for mod actions.
- UserId→username cache: `cache:userId-username:{userId}` (expiring string) and legacy hash `cache:userId-username`.

## External integrations
- Reddit API: submit posts/comments/PMs, fetch subreddit name, user lookup.
- OpenAI: Chat Completions (`https://api.openai.com/v1/chat/completions`) with model from settings/env; JSON-formatted response enforced.
- Supabase: optional answer event logging when HTTP permissions allow it.

## Operational flows
- Gameplay (web UI):
  1) Web client loads user → start round → `/api/riddle/create`.
  2) Player submits answer → `/api/answer/submit` → result view.
  3) Optional share → `/api/share` → navigate to post.
- Moderation/deployment:
  - Mods use the Install Game menu action to create/pin the hub post.
  - `CommentCreate` and `AppUpgrade` triggers continue to run in the Blocks entry.
