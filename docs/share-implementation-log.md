# Debattle Share Feature Implementation Log

Purpose: track implementation steps, decisions, and bugs encountered while rebuilding the Share feature.

## 2025-12-18
- Initialized log and confirmed alignment on using server-side `submitCustomPost` per PRD/plan. Pending implementation steps to wire handler, service updates, and UI hardening.
- Registered a render-only `Share Post` custom post type to render shared posts without making it a front door.
- Reworked `Service.shareResponseToSubreddit` to prefer `submitCustomPost` with `entry: 'share'`, embedded `postData` (clamped to ≤2 KB), `textFallback`, and telemetry (`share:attempt/success/failure`). Added PNG size guard, text-only fallback when upload fails, and one-share eligibility (blocks zero-score shares).
- Updated share title to PRD format and now persist/share `shareImageUrl`/`permalink` even when falling back to text-only submissions.
- UI share flow now blocks zero-score shares, shows success navigation to the permalink (using `navigateTo`/`openLink`), and keeps retry-friendly error handling.
- Known risk to verify: Blocks runtime may still lack `submitCustomPost`; fallback path uses `submitPost` (text + optional image) and logs the capability flag. Need playtest confirmation that custom post path is available and that adding the share entry does not hijack the playtest front door.

## 2025-12-19 9:45AM ICT
- Issue: Playtest “Install Game” now renders “Shared post unavailable” instead of the Debattle hub; the game entry disappears. Cause: adding the `Share Post` custom post type changed the default front-door entry. Our install flow posts via `reddit.submitPost` without specifying an entry/custom type, so the runtime picks the latest custom post type (Share Post), which renders the empty share view when no postData/image is present. This reintroduced the postmortem pitfall of front-door hijack.
- Proposed fix to restore install and keep share plan:
  1) Remove the separate `Share Post` custom post type registration so the front door stays on the Install/Pinned entry.
  2) Route share rendering inside the existing custom post render: detect `postData.entry === 'share'` (or presence of share payload) and render the share view there; otherwise render the normal Router/pinned experience. Keep submitCustomPost calls using `entry: 'share'` and embed postData/textFallback per plan.
  3) Update install flow if needed to submit the pinned post explicitly to the Install/Pinned entry (or set an explicit entry name) so the front door remains stable.
 - Implemented fix: removed the standalone `Share Post` custom post type; updated `Router` to detect `postData.entry === 'share'` (or share payload) and render `SharePostEntry` inline, otherwise render the normal Debattle hub. This mirrors Pixelary’s “unregistered share entry” approach and should restore the Install/Pinned front door while keeping share rendering available via postData/permalink.

## 2025-12-19 10:15AM ICT
- Issue: Hitting Share now logs `[Service.logShareTelemetry] failed TypeError: this.redis.lPush is not a function`, and `submitCustomPost` is unavailable so the flow falls back to `submitPost`.
- Cause: Devvit Blocks Redis client doesn’t expose `lPush`/`lTrim`; telemetry helper used unsupported commands. Also, Blocks runtime still lacks `submitCustomPost`, so we hit the fallback path.
- Fix: Telemetry now uses `get`/`set` to maintain a bounded JSON array (≤100 entries) per key (`share:telemetry:{kind}`), avoiding list commands. `submitCustomPost` unavailability remains a platform limitation; the plan still relies on a server/web handler for the real Pixelary path.
## 2025-12-19 10:30AM ICT
- Share attempts still hit the fallback because the Blocks runtime lacks submitCustomPost; our code detects the missing function and uses submitPost.
- This is expected until we add a server/web handler with Reddit client support for the Pixelary-style path.
## 2025-12-22 10:45AM ICT
- Error: `Error: server is not allowed to have the additional property "dir"` after adding `server.dir` to `devvit.json`.
- Likely cause: current Devvit config schema/tooling accepts `server.entry` only (no `dir` field), or is using an older schema.
- Fix: remove `server.dir` and set `server.entry` to `dist/server/index.js` so the schema validates; rebuild the server bundle at that path before playtest/upload. If the error persists, update the Devvit CLI/runtime to a version that supports `server.dir`.

## 2025-12-22 11:06AM ICT
- Error: `[Service.shareResponseToSubreddit] submitCustomPost unavailable, falling back to submitPost` during playtest.
- Likely cause: the server share endpoint is not being used (server bundle not running, server entry path incorrect, or server call failed so the client path ran). In Blocks runtime, `submitCustomPost` is expected to be unavailable.
- Fix: ensure `dist/server/index.js` is built and `devvit.json` points `server.entry` to that file, then re-run playtest so `/api/share/submit` is live. Check logs for `serverError` telemetry and confirm the share path uses `submitPath: server`.

## 2025-12-22 11:11AM ICT
- Verification attempt: no direct access to Redis telemetry from the local workspace; telemetry lives in Devvit Redis during playtest.
- Evidence: the only visible runtime log is the fallback message, which implies the client path ran; no `submitPath: server` evidence yet.
- Updated fix approach: confirm the server bundle is built and loaded, then re-run playtest while streaming logs (look for `submitPath: server` in telemetry or add a temporary debug menu/endpoint to dump `share:telemetry:*`). If server calls still fail, surface `serverError` in logs to pinpoint why `/api/share/submit` is not reachable.

## 2025-12-22 11:22AM ICT
- Updated verification plan with concrete logs and steps to prove the server path is used.
- Added logs in `src/server/index.ts` (`[ShareServer] boot`, `request`, `submitted`, `submit failed`) and in `src/services/Service.ts` (`server submit ok`, `server submit failed`).
- Fix approach (specific): build `dist/server/index.js`, run playtest, press Share, and confirm the log sequence shows server boot + request + submitted; if missing, re-check `devvit.json` `server.entry`, rebuild, and re-run. If server logs show errors, use the emitted `serverError` to diagnose the failing call.

## 2025-12-22 11:43AM ICT
- Issue: running `npx tsc -p tsconfig.json` failed with 52 TypeScript errors across 12 files, so `dist/server/index.js` was not emitted.
- Error categories observed:
  - Devvit Blocks type mismatches (`Devvit.Blocks.Component`, `Devvit.Blocks.Gap` missing in 0.12.5).
  - Invalid prop values (`resizeMode="stretch"`, `gap="xsmall"`, object padding types not matching `ContainerPadding`).
  - Hook API mismatch (`useState` expects JSONValue only, no dependency array) causing state types to collapse to boolean.
  - Missing `Devvit` import in `SharedPostView`.
  - JSON import in `questionBank.ts` requires `assert { type: 'json' }` under `NodeNext`.
  - Server bundle errors: `Scope` not exported from `@devvit/public-api` and `RedditAPIClient` is type-only when imported from the top-level entry.
- Implication for Share feature: server bundle build failure blocks `/api/share/submit`, so the flow falls back to client `submitPost` (which does not meet the PRD requirement for reliable share previews via `submitCustomPost`).

- Option A: Fix all TypeScript errors and keep a single `tsc` build for both client and server.
  - Pros: restores full type safety across the app; ensures server bundle is emitted and aligned with current UI/runtime; reduces hidden runtime bugs; consistent developer workflow.
  - Cons: larger scope and time; many UI/typing changes (padding/gap enums, hook usage, JSON imports) may subtly alter layout/UX; higher regression risk.
  - Share feature impact: once fixed, server bundle emits correctly and server handler works; fully aligned with PRD path (`submitCustomPost`, postData rendering).
  - System/UX impact: long-term stability improvement, but short-term UX changes possible due to spacing/prop normalization.

- Option B: Add a server-only build path to emit `dist/server/index.js` without fixing UI types yet.
  - Approach: create `tsconfig.server.json` that only includes `src/server/**` (and required dependencies), then run `npx tsc -p tsconfig.server.json` before playtest/upload. Fix only server import issues (`Scope` via protos or use `userActions: true`, and import `RedditAPIClient` from its concrete path).
  - Pros: fastest path to restore server handler and PRD-compliant sharing; minimal risk to UI/UX and existing flows; isolates change scope.
  - Cons: leaves the main project in a type-error state; requires an extra build step and can confuse contributors; technical debt remains.
  - Share feature impact: unblocks `/api/share/submit` quickly and stops client fallback; share previews should render correctly.
  - System/UX impact: no immediate UX changes, but type errors elsewhere remain unresolved and may mask future regressions.

## 2025-12-23 11:13AM ICT
Decide to go with Option A => Update Share-Feature-Implementation-Plan as a Prerequisite to Step 1 "Wire Server Handler"

## 2025-12-23 14:56 ICT
- Issue: Game fails to install during playtest. Logs show `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@devvit/server' imported from /srv/main.js` (repeats).
- Impact: app cannot install/run, blocks share flow verification.
- Resolution plan (specific):
  1) Add `@devvit/server` as a runtime dependency (not just dev) so the packaged app can resolve it in `/srv`:
     - `npm i @devvit/server@0.12.5` (match `@devvit/public-api` version).
     - Ensure it lands under `"dependencies"` in `package.json`, then re-run `npm install`.
  2) Rebuild and ensure the server bundle is emitted:
     - `npx tsc -p tsconfig.json` and confirm `dist/server/index.js` exists.
     - Verify `devvit.json` includes `server.entry: "dist/server/index.js"`.

## 2025-12-23 15:11 ICT
- Issue: Rebuilt and re-ran playtest; still seeing `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@devvit/server' imported from /srv/main.js`.

## 2025-12-24 09:54 ICT
- Situation: Playtest error persists even after `@devvit/server` is installed and `dist/server/index.js` exists.
- Finding: Devvit does not bundle `server.entry`; it ships the file as-is. Our `dist/server/index.js` still imported `@devvit/server` at runtime, which fails in `/srv` because node_modules are not available. Bundling the server entry is required.
- Evidence: Pixelary builds a dedicated server bundle (`vite build`) to `dist/server/index.cjs` and points `devvit.json` to that file.
- Update: added `server:build` npm script using esbuild to bundle `src/server/index.ts` into `dist/server/index.js`. Verified the bundled file has no runtime `import/require` of `@devvit/server` (use `grep`, since `rg` isn’t available).
- Next steps (ordered):
  1) `npx tsc -p tsconfig.json` (typecheck only).
  2) `npm run server:build` (must run after tsc so the bundle isn’t overwritten).
  3) `devvit playtest` → expect `[ShareServer] boot`.
  4) If error persists, switch to Pixelary-style CJS bundle (`--format=cjs --outfile=dist/server/index.cjs`) and update `devvit.json` `server.entry` accordingly.

## 2025-12-24 10:02 ICT
- Situation: Playtest still reports `Cannot find package '@devvit/server' imported from /srv/main.js` even after bundling.
- Note: The `@devvit/web/server` Reddit client guidance applies to Devvit Web apps. This project is a Blocks app (`devvit.json` uses `blocks.entry`), so the correct server client is `RedditAPIClient` from `@devvit/public-api`, and the `/api/share/submit` handler is already using it.

## 26-12-26 11:37 ICT
- Pause the Pixelary-style share implementation (server handler + PNG card).
- Revert to the simple markdown share UX (text-only post) as the short-term baseline.
- Preserve the current Pixelary progress in a separate branch so it can be resumed later.
- Update Share-Implementation-Plan with Revert Plan. 

## 2025-12-29 10:44 ICT
- Added share flow logs in UI and service to trace submit, state updates, and navigation for the "post not visible instantly" issue.
- Observed `submitPost` returns `postId`/`permalink` but posts can be delayed in subreddit feed when run as the app account.
- Fix: enable user-scoped posting with `Devvit.configure({ userActions: true })` and submit shares with `runAs: 'USER'` so posts appear instantly under the player.
- Added permission-aware error toast when user scopes are missing or denied.
- UI fallback: add "Open post" button in share preview and wire `openSharePermalink` through the round flow so navigation is always available.

## 2025-12-29 11:13 ICT
- Latest error: share logs show `submitPost ok` with a valid `postId`/`permalink` and `shareToSubreddit: navigating to permalink`, but the app does not navigate and the post does not appear instantly in the subreddit feed.
- Cause A (navigation): `navigateTo` was emitted after the async share resolved (outside the onPress handler), so the Blocks UI dropped the effect.
- Cause B (visibility): new posts were filtered (spam/removed/mod queue), so they existed via permalink but did not show immediately in the listing.
- Fixes applied:
  - Enable user-scoped posting: `Devvit.configure({ userActions: true })` and submit shares with `runAs: 'USER'`.
  - Add permission-aware toast when user scopes are missing/denied.
  - Make the share button handler async and `await onShare()` so `navigateTo` fires within the UI event.
  - Log moderation status (`approved`, `spam`, `removedByCategory`) and attempt `post.approve()` when filtered (works when the posting user has mod rights).
  - Keep the "Open post" fallback button wired through `openSharePermalink`.
- Result: share now navigates immediately and the post appears instantly once approved (or when not filtered).
