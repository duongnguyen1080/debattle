# Debattle System Architecture

## Overview
- Devvit-powered Reddit app that runs fully inside the Devvit runtime. The app enables players to answer curated philosophical riddles, receive AI-based scoring, level up, and optionally share their answers back to the subreddit as media posts.
- Core runtime capabilities enabled in `src/main.tsx`: `redditAPI`, `redis`, `http`, `media`, and `userActions`.
- All server-side logic lives in `src/services/Service.ts` and is invoked from UI components and triggers. Redis is the sole state store.

## Platform setup
- Settings (App scope): `openaiApiKey`/`OPENAI_API_KEY`, `openaiModel`/`OPENAI_MODEL` for AI evaluation. No settings are required for Reddit/Redis; they come from Devvit.
- Custom post type `Install Game` renders the main Router. Moderator menu items:
  - `Install game` pins a “Debattle — Community Hub” post and caches subreddit name in Redis.
  - `Debattle: Create Pinned Hub` publishes an unpinned hub post.
  - `Debattle: Top Weekly Debattle` (placeholder) shows a toast only.
- Triggers registered in `main.tsx`:
  - `CommentCreate` → `Service.onEvent` for legacy comment-based commands.
  - `AppUpgrade` → `Service.handleAppUpgrade` to clean expired riddles.

## Frontend flows (Devvit Blocks UI)
- Entry point `Router` (`src/components/Router.tsx`):
  - Resolves current user via `hydrateCurrentUser` (maps `context.userId` → username via Reddit API, caches in Redis, then fetches/creates user in Service).
  - Routes between views: home (default), play, leaderboard/info/progress (via `PinnedPost`), and a splash loader.
- Home screen (`HomeScreen`) shows a “Knock The Door” CTA that starts a round.
- Round flow (`RoundV2Flow` + `useRoundFlow`):
  - Picks a random riddle prompt from `data/debattle_questions.json` (no player-written riddles; themes are implicit).
  - Calls `Service.createRiddleFromTheme` to persist a new riddle (24h lifespan) in Redis and display its text.
  - Answer step (`RoundAnswerView`) opens a form limited to 100 non-space/punctuation chars. On submit, calls `Service.submitAnswer`.
  - Result step (`RoundResultView`) shows the question and player answer, Arete points if available, and, if shareable, the Debattle button posts via `Service.shareResponseToSubreddit`.
- Community hub (`PinnedPost`):
  - Loads leaderboard via `Service.getLeaderboard`.
  - Hydrates current user if not provided and shows level/xp/flair plus progress stats and next-tier info.
- Splash screen is used as a mask while data loads; viewport sizing helpers adapt parchment layout to screen height.

## Backend services (`src/services/Service.ts`)
- User management:
  - Users stored as JSON in Redis hash `users`. `hydrateCurrentUser` creates a default user if missing.
  - `updateUserXp` recalculates level/flair (see `types/LEVEL_TIERS`) and sends a Reddit PM on level up.
- Riddle lifecycle:
  - `createRiddleFromTheme` creates a `RiddleV2` with a curated question, stores at `riddle:{id}`, and tracks active IDs in `riddles:active` (24h expiry window).
  - Responses appended to the riddle record; cleanup of expired riddles runs on `AppUpgrade`.
- Answer evaluation (`submitAnswer`):
  - Heuristic scoring (wit/logic/style 0–5 each) plus fallback feedback/decision (open/ajar/closed).
  - Attempts AI grading via `evaluateAnswerWithAI`, which calls OpenAI Chat Completions with the Arete rubric (`ARETE_SYSTEM_PROMPT`). If relevance is “Yes”, Arete points (up to 90) drive the door decision and feedback; otherwise fallback scoring is used.
  - Persists response, updates user XP by heuristic total, and returns feedback/decision plus Arete data.
- Sharing to subreddit (`shareResponseToSubreddit`):
  - Resolves subreddit (cached from install, else `getCurrentSubredditName`).
  - Builds a PNG share card by rendering an SVG (`createShareCardSvg`) and converting with `svg2png-wasm` (embedded WASM via `constants/svg2pngWasm.ts`); uploads through `context.media.upload`.
  - Submits a user-generated-content post with image and summary text; caches `postId`, `sharePermalink`, `shareImageUrl` on the stored response.
- Leaderboards & stats:
  - `getAllUsers` normalizes level/flair; `getLeaderboard` sorts by XP and returns rank.
  - Utility `syncAnswerPostUpvotes` can award +5 XP per 10 upvotes on shared answers; `upvoteGuess` does the same for guesses. These are callable helpers, not automatically wired to events.
- Legacy comment commands (`onEvent` on `CommentCreate`):
  - `!answer <elapsed_ms> | <text>` scores via `submitAnswer` and replies with score/decision/feedback.
  - `!guess <text>` stores a guess under `riddle:{id}:guesses` and replies that reflections are recorded. Upvote-based bonuses rely on manual `upvoteGuess`.

## Data model & persistence (Redis)
- `users` (hash): `{ username: User JSON }` with xp/level/flair/stats.
- `riddle:{id}` (string): `RiddleV2` containing meta (theme/questionId/text), author, timestamps, status, and `responses: PlayerResponse[]`.
- `riddles:active` (stringified array): active riddle IDs for expiry cleanup.
- `riddle:{id}:guesses` (stringified array): legacy guesses/reflections.
- `debattle:pinnedPostId`, `debattle:settings` (subredditName cache) for mod actions.
- UserId→username cache: `cache:userId-username:{userId}` (expiring string) and legacy hash `cache:userId-username`.

## External integrations
- Reddit API: submit posts/comments/PMs, fetch subreddit name, user lookup, post lookup for upvote sync.
- OpenAI: Chat Completions (`https://api.openai.com/v1/chat/completions`) with model from settings/env; JSON-formatted response enforced.
- Media: Devvit `media.upload` for PNG share cards; uses embedded `svg2png-wasm` to avoid hosting binaries separately.

## Operational flows
- Gameplay (UI):
  1) Router hydrates user → Home CTA → `createRiddleFromTheme`.
  2) Player submits answer → `submitAnswer` → result view (door decision, feedback, Arete points).
  3) Optional share → Debattle button posts image + summary via `shareResponseToSubreddit`.
- Leaderboard/progress:
  - `PinnedPost` polls Service once to load leaderboard and current user stats; displays next level requirements from `LEVEL_TIERS`.
- Moderation/deployment:
  - Mods use menu actions to install/publish hub posts; install pins and saves subreddit name used for sharing.
  - `AppUpgrade` trigger cleans expired riddles from `riddles:active` and archives them.
