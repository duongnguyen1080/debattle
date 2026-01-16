# Debattle Share Feature Implementation Plan

## Decision 26-12-26
- Pause the Pixelary-style share implementation (server handler + PNG card).
- Revert to the simple markdown share UX (text-only post) as the short-term baseline.
- Preserve the current Pixelary progress in a separate branch so it can be resumed later.

## Revert Plan (simple markdown UX)
1) Create a branch to preserve the current Pixelary share work.
2) Restore `Service.shareResponseToSubreddit` to the markdown-only `submitPost` flow (no image generation, no `submitCustomPost`, no server submit).
3) Remove share server artifacts: `src/server/**`, server build config/scripts, and `devvit.json` server entry.
4) Remove share-only rendering/entry components and routing (`SharePostEntry`, `SharePostPreview`, `SharePreviewScene`, `SharedPostView`, and the share entry switch in `Router`).
5) Remove share-only types/constants/assets (`src/types/share.ts`, `src/constants/**`, svg2png wasm) and clean unused imports.
6) Verify: share CTA posts markdown, persists `postId`/`permalink`, and the front door is not hijacked.

Note: the Pixelary-style plan below is deferred until we resume that branch.

## Goals (per PRD)
- Post finished rounds as Reddit posts (one share per response, only if score > 0) with title `This is <user-name> answer. What is yours?`.
- Posts include a PNG share card plus meaningful fallback text covering riddle, answer, decision (open/ajar/closed), and feedback snippet.
- On success, persist `postId`, `permalink`, and `shareImageUrl`, toast success, and auto-navigate to the permalink; on failure, show a retryable error.
- Run as user-generated content with `runAs: 'USER'`; block sharing if permission is denied.

## Pitfalls to Avoid (from 2025-12-03 postmortems)
- Do not rely on Blocks `submitCustomPost` (missing) or `submitPost` image previews; use a server/web handler that supports `submitCustomPost`.
- Always embed share payload in `postData`; do not depend on Redis cache for rendering shared posts.
- Keep a single front-door post type (Install/Pinned); do not register a separate share entry that hijacks playtest.
- Prevent “Sharing…” freezes: manage loading state, success navigation/toast, and retryable errors.
- Guard Devvit imports in new JSX files to avoid runtime crashes.

## Architecture & Posting Path
1) **Server share handler (Pixelary-style)**  
   - Add a server/web handler (e.g., `share/submit`) that receives `responseId`, `riddleId`, and rendered fields and calls `reddit.submitCustomPost({ entry: 'share', runAs: 'USER', userGeneratedContent: { imageUrls, text }, postData, textFallback })`.  
   - Keep the `share` entry unregistered as a front door; it should render only when the permalink is opened.
2) **Share payload**  
   - `postData` (≤ 2 KB) includes: riddleId, responseId, username, decision, score display, riddle text (truncated), answer (truncated), feedback snippet (truncated), shareImageUrl, createdAt. This lets the shared view render offline from cache.
   - `textFallback` mirrors the markdown summary to remain meaningful without the image.
3) **Image generation & upload**  
   - Reuse `createShareCardSvg` → `svg2png-wasm` to produce PNG; enforce size guard (20 MB) and catch encoder errors with a soft fallback to text-only (but keep `postData` intact).  
   - Upload via `media.upload({ url: dataUrl, type: 'image' })`; feed returned URL into `userGeneratedContent.imageUrls`.
4) **Eligibility & rate limits**  
   - Deny share when score ≤ 0 or `postId` already exists (both UI + server). Optionally cap daily shares per user in Redis (counter + TTL) if abuse risk.

## UX Flow Updates
- **Share preview**: Disable CTA with messaging for zero score/already shared; show spinner while posting.  
- **Success**: Toast “Shared to the community!”, store metadata, and auto-navigate to `permalink` (use `context.ui.navigateToUrl` or `openLink` depending on availability).  
- **Failure**: Show error with “Retry” CTA; keep rendered data in memory so retry does not re-answer.  
- **Transparency**: Confirm posts run as the user; surface permissions error if `runAs: 'USER'` fails.

## Telemetry & Persistence
- Log to Redis lists/hashes: `share:attempt`, `share:success`, `share:failure` with riddleId/responseId/username/timestamp/error.  
- Persist `postId`, `permalink`, `shareImageUrl` back onto the response object in Redis; include optimistic update in UI state to update buttons/toasts instantly.

## Incremental Delivery Plan
0) **Prerequisite: Restore single `tsc` build** so `npx tsc -p tsconfig.json` passes and `dist/server/index.js` is emitted (required for the server handler to run).  
   - **Re-run `tsc` and triage errors by category**: Devvit Blocks types, invalid props, hook API mismatches, missing imports, JSON import rules, and server-only type errors.  
   - **Normalize Devvit Blocks props/types**: replace unsupported `gap`/`resizeMode` values, ensure `padding` matches `ContainerPadding`, and update any stale `Devvit.Blocks.Component`/`Gap` types to supported equivalents.  
   - **Fix hook API mismatches**: remove dependency arrays from `useState`, ensure state values are JSON-safe (`JSONValue`), and adjust state initialization where types collapsed.  
   - **Repair imports**: add missing `Devvit` imports (e.g., shared post view), and align any JSX files with expected Devvit imports to avoid runtime crashes.  
   - **Resolve JSON import errors**: either add `assert { type: 'json' }` under NodeNext or convert JSON data to a TS/JS export so `tsc` compiles.  
   - **Unblock server build types**: import `RedditAPIClient` from its concrete path, and resolve `Scope` usage (via correct proto import or `userActions: true`) so `src/server/**` compiles.  
   - **Re-run `tsc` and validate output**: confirm `dist/server/index.js` is emitted, then proceed with the Server Path Verification section.  
1) **Wire server handler** for `submitCustomPost` + `postData/textFallback` and return `postId/permalink/imageUrl`.  
2) **Update Service.shareResponseToSubreddit** to call the handler, embed payload, enforce eligibility, and write telemetry + persistence.  
3) **UI flow**: guard CTA, show loading/success/failure states, navigate to permalink on success, expose retry.  
4) **Rendering entry (view-only)**: add a lightweight shared-post renderer that consumes `postData`; do not register it as a main entry.  
5) **Hardening**: postData size check/truncation, media size guard, permission-denied handling, Redis fallback for metadata.  
6) **Validation**: manual playtest covering success, permission denial, media upload failure (text-only fallback), duplicate-share attempt, and zero-score block; ensure shared posts show image + fallback text in feed.

## Server Path Verification (Playtest)
- **Build**: run `npx tsc -p tsconfig.json` and confirm `dist/server/index.js` exists (matches `devvit.json` `server.entry`).
- **Server boot log**: expect `[ShareServer] boot` from `src/server/index.ts` on playtest start.
- **Request log**: when pressing Share, expect `[ShareServer] request` with `/api/share/submit`.
- **Submit log**: on success, expect `[ShareServer] submitted` with `postId`.
- **Client log**: expect `[Service.shareResponseToSubreddit] server submit ok` when the server path is used.
- **If missing**: no server logs means the server bundle is not loaded; re-check `devvit.json` `server.entry`, rebuild, and re-run playtest. If still missing, update the Devvit CLI/runtime. If server logs show errors, use `[ShareServer] submit failed` and `serverError` to diagnose why `/api/share/submit` is failing.

## Test Plan (manual until automation exists)
- Share eligible round → expect PNG preview in subreddit feed, correct title format, fallback text visible in markdown-only view.  
- Verify postData-driven render by temporarily blocking Redis (simulate cache miss).  
- Repeat share on same response → blocked with “Already shared”.  
- Attempt share with score 0 → CTA disabled.  
- Force `media.upload` failure → post publishes (if allowed) with text-only fallback and telemetry failure logged.  
- Confirm navigation/toast on success and retry path on failure.  
- Confirm no extra custom post type appears in playtest front door.
