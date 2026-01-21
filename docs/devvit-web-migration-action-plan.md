# Devvit Web Migration Research and Action Plan

## Scope and goal
Migrate the Debattle app from a Blocks-only Devvit app to Devvit Web (client + server) while keeping the existing Blocks entry running during the transition. The goal is feature parity with the current gameplay flow and a path to phase out Blocks once the web client is stable.

## Current app inventory (repo findings)
- Config: `devvit.json` has `blocks.entry` and http permissions for OpenAI and Supabase; web entries are now scaffolding and should follow the current `post.dir` + `post.entrypoints` schema.
- Entry point: `src/main.tsx` configures redditAPI, redis, http, media, and userActions; registers a custom post type, a mod menu item, and triggers.
- UI (Blocks):
  - `src/components/Router.tsx` routes between Home, Play, and Achievements views.
  - `src/components/screens/HomeScreen.tsx`, `AnswerRiddleScreen.tsx`, `ResultReviewScreen.tsx`, `AchievementsScreen.tsx` implement the core UI.
  - `src/components/play/usePlaySession.ts` owns the gameplay flow, uses `useForm` and `context.ui` APIs.
  - Custom visual system uses image tiles and SVG glyph rendering (`ParchmentPanel`, `FontText`, `AnswerFontText`) plus large asset sets under `assets/`.
- Backend services:
  - `src/services/Service.ts` composes flows for riddles, answers, shares, users, and events.
  - `src/services/flows/answerFlow.ts` calls OpenAI and logs to Supabase, plus writes to Redis.
  - `src/services/flows/shareFlow.ts` posts to Reddit as the user and writes back to Redis.
  - `src/services/flows/userFlow.ts` sets flair and sends DMs via Reddit API.
  - `src/services/flows/riddleFlow.ts` and `eventFlow.ts` handle riddle lifecycle and comment-based triggers.
- Data and storage:
  - Riddle content is local JSON (`src/data/debattle_questions.json`) accessed by `src/utils/questionBank.ts`.
  - Redis keys are used for riddle storage, active riddle lists, and cached settings.
- Build pipeline:
  - `package.json` scripts only run `devvit playtest` and `devvit upload/publish`.
  - No client or server bundling; `dist/` is the Blocks build output.

## Target Devvit Web architecture
- Keep Blocks entry for compatibility while web is built.
- Add Devvit Web client and server entries in `devvit.json`:
  - `post.dir: "dist/client"` with `post.entrypoints.default.entry: "index.html"` (and height).
  - Optional `post.entrypoints.game` for the gameplay view, entered via `requestExpandedMode`.
  - `server.entry` to `dist/server/index.cjs`.
- Create explicit client and server code:
  - `src/client/` for the web UI (React or similar).
  - `src/server/` for HTTP endpoints using `@devvit/web/server`.
  - Optional: move Blocks-only code into `src/devvit/` to make boundaries clear.
- Build pipeline:
  - Vite client build -> `dist/client/`.
  - Vite server build -> `dist/server/index.cjs` (node target).
  - Devvit build continues for Blocks (either from `src/` or a new `src/devvit/` root).

## Migration map (feature to new location)
- Gameplay UI (Home, Answer, Result, Achievements): Web client.
- Data and scoring (riddle creation, submit answer, share): Web server endpoints that call existing Service flows.
- User data and flair updates: Web server (needs Reddit API access).
- Comment triggers and mod menu items: keep in Blocks for now; optionally rewire to call Web server via `fetchDevvitWeb`.
- Assets and fonts: move or copy to client bundler; decide on a font strategy (web fonts or keep SVG glyphs).
- Share card image: current Blocks flow fell back to markdown-only sharing because PNG share cards were blocked by Blocks limitations; Devvit Web should restore PNG share cards via server-side `submitCustomPost`/`postData` per the share docs (`docs/share-feature-prd.md`, `docs/share-feature-implementation-plan.md`, `docs/share-implementation-log.md`).
- Launch/entrypoints: use a default launch screen entrypoint and an optional gameplay entrypoint to expand into the full experience.

## Action plan
### Phase 0 - Alignment and decisions
Deliverables:
- Confirm scope: full UI parity vs staged UI replacement.
- Decide on font strategy (native web fonts vs SVG glyph rendering).
- Choose client stack (React + Vite recommended for Devvit Web).
Decision note:
- Font strategy: exact match web fonts using Pirata One and Merriweather WOFF2 files.
  -  Implementation: self-host WOFF2 in the web client bundle, preload them, and migrate text sizing/spacing to CSS-based layout rather than glyph-metric rendering.
  - Risk: layout drift vs Blocks UI due to font metric differences and webview rendering variance, requiring re-tuning of sizes and line breaks.
- Client stack: React + Vite (aligned with Devvit Web recommendations).
- UI direction: web-native responsive reinterpretation that preserves visual DNA (fonts, parchment motif, imagery) while allowing layout changes per breakpoint.
- Migration approach: move to full Web as quickly as possible; keep Blocks only as a safety net during transition and retain Blocks UI only for features that cannot be replaced with a Web-equivalent.
- No Web-equivalent checklist: define when a feature is “not possible on Web” and therefore should stay in Blocks - keep Blocks only if all apply:
  - Requires a Devvit capability not available in Devvit Web. 
  - There is no supported Devvit Web API or documented workaround.
  - Removing it would break a moderator or system-critical workflow.
  - A Web replacement would materially change the feature's behavior or permissions model.

### Phase 1 - Add Devvit Web scaffolding
Deliverables:
- Update `devvit.json` with `post.dir` + `post.entrypoints` and `server.entry` while keeping `blocks.entry`.
- Define entrypoints scaffolding (`default` launch screen and optional `game` entrypoint for expanded mode).
- Create `src/client/` and `src/server/` placeholders.
- Add Vite configs for client and server builds to `dist/client` and `dist/server`.
- Add build scripts (for example: `build:web`, `build:client`, `build:server`) and keep existing `devvit upload` flow.
- Add a web font asset pipeline (self-host Pirata One + Merriweather WOFF2, preload in client).
Risks:
- `dist/` collisions between Devvit build output and Vite outputs. Mitigate by ensuring Vite writes to `dist/client` and `dist/server` and that Devvit build does not delete them.
- Package `type: "module"` plus CJS server output. Mitigate by ensuring the server build writes `index.cjs` and uses CJS output format.

### Phase 2 - Web server implementation
Deliverables:
- Add a `src/server/index.ts` that exports a Devvit Web server using `@devvit/web/server`.
- Implement `/api/...` endpoints (Devvit Web requirement) that map to Service flows:
  - `POST /api/riddle/create` -> `Service.createRiddleFromTheme`
  - `POST /api/answer/submit` -> `Service.submitAnswer`
  - `POST /api/share` -> `Service.shareResponseToSubreddit`
  - `GET /api/user/current` -> `hydrateCurrentUser`
  - Optional: `GET /api/riddle/:id` or `/api/health`
- Wire server context to Service (redis, reddit, settings).
- Keep OpenAI and Supabase calls server-side only.
- Restore PNG share cards via server-side `submitCustomPost`/`postData` (per share docs).
Risks:
- Missing `/api` prefix will break routing in Devvit Web; keep all routes under `/api`.
- User posting and flair updates require `userActions` and user consent; share should fail gracefully if permission is missing.
- OpenAI latency or failures can block request handling; keep timeouts and return fallback scores as now.

### Phase 3 - Web client implementation
Deliverables:
- Build web UI that mirrors current flows:
  - Home -> Answer -> Result -> Achievements.
  - Timer, answer length validation, and share flow.
- Replace Blocks `useForm` and `context.ui` usage with web UI equivalents.
- Use `@devvit/web/client` for navigation and Reddit-specific actions.
- Implement client API layer to call `/api/*` endpoints.
- Implement a mobile-first responsive system with breakpoints and layout rules that preserve the visual DNA while adapting per viewport.
- Implement launch screen entrypoint and transition into gameplay via `requestExpandedMode` (if using multiple entrypoints).
Risks:
- Recreating custom typography and parchment layout may be non-trivial; if web fonts are chosen, layout metrics must be reworked.
- Webview sizing differs from Blocks `viewportHeight`; design must be responsive to real window size.
- Assets in `assets/` must be copied or imported into the client build, or moved under `src/client/assets`.

### Phase 4 - Hybrid and migration bridge
Deliverables:
- Timebox the hybrid period; keep Blocks as a safety net only.
- Update Blocks UI to call Web server endpoints via `fetchDevvitWeb` only where needed during the transition.
- Keep comment-based triggers in Blocks (AppUpgrade and CommentCreate) to avoid breaking existing behavior, unless a Web replacement is proven.
Risks:
- Duplicate logic if both Blocks and Web server manipulate the same data; ensure only one path writes for each action.
- Block UI + web server dependency increases complexity; keep the bridge temporary.

### Phase 5 - Cutover and cleanup
Deliverables:
- Switch custom post type to Web client as the default experience.
- Remove Blocks UI and related stack once Web parity is validated, except for any features without Web-equivalents.
- Keep a minimal Blocks entry only for non-replaceable features (for example, mod actions/triggers), and document what remains.
- Update docs and remove unused Blocks UI code after cutover.
Risks:
- Removing Blocks too early could drop mod menu items and triggers. Ensure replacements exist or keep a minimal Blocks entry.

## Risks and mitigations summary
- Asset and font fidelity risk: current UI relies on SVG glyph assets and custom layout. Mitigate by self-hosting WOFF2 fonts, preloading them, and re-tuning layout per breakpoint.
- Permission and auth risk: user posting, flair, and DMs require userActions and consent. Mitigate with clear user prompts and fallback paths when permissions are missing.
- Build output collisions: Devvit and Vite both write to `dist/`. Mitigate with strict output directories and build ordering.
- Secret leakage risk: OpenAI and Supabase keys must stay server-side. Mitigate by centralizing all external API calls in server endpoints.
- Latency and reliability risk: OpenAI calls can be slow or fail. Mitigate with timeouts and fallback scoring (already implemented).
- Data consistency risk: riddle creation and answer submission must be single-source-of-truth. Mitigate by moving creation and submit logic to server endpoints and keeping the client stateless.
- Responsive QA risk: a mobile-first layout can diverge from Blocks layouts across devices. Mitigate with breakpoint-specific QA and visual regression checks for key screens.
- Entrypoint/expanded-mode risk: launch screen and gameplay entrypoints can drift or mis-route. Mitigate by keeping a single source of routing state and testing entrypoint transitions.

## Open questions
- Should we keep Blocks UI for a longer hybrid period, or migrate quickly to full Web? Answer: migrate quickly to full Web; keep Blocks only to prevent breakage during transition, and retain Blocks UI only for features with no Web-equivalent.
- What is the preferred font strategy (downloaded web fonts vs SVG glyph rendering)? Answer: exact-match web fonts (Pirata One + Merriweather WOFF2, self-hosted).
- Do we need to preserve legacy comment-based `!answer` flow, or can it be deprecated? Answer: deprecate after web cutover, keep temporarily as fallback during migration.
