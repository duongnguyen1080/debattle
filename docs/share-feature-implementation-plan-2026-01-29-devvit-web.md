# Debattle Devvit Web Share Plan (Pixelary-Style Screenshot) — 2026-01-29

Context: Re-implement the Pixelary-style share flow so shared posts use a generated screenshot of the result (PNG) rather than markdown-only posts. This plan is based on the current Debattle Devvit web app codebase and prior research/decisions in the linked docs.

## Goals (must-haves)
- Share creates a Reddit post with an image preview (PNG) of the result screen + meaningful text fallback.
- Posting runs as the user (`runAs: 'USER'`) and blocks when permissions are missing/denied.
- One share per response; score must be > 0.
- Shared post render is self-contained via `postData` (no Redis dependency).
- Success auto-navigates to the permalink; failure is retryable and does not lose state.

## Non-goals
- Additional front-door post types or new entry points that hijack the install/pinned experience.
- Editable share content or multi-format share variants.

## Current Constraints & Lessons (from prior work)
- Blocks runtime lacks `submitCustomPost`; use a server/web handler to call `submitCustomPost` (Pixelary path).
- Share rendering must be driven by `postData` to avoid cache-miss failures.
- Keep the share entry unregistered as a front door; render conditionally when `postData` indicates a share.
- Avoid `@devvit/server` runtime dependencies in the shipped bundle; server entry must be bundled.

## Architecture Overview (Target)
1) **Client (Web UI)** renders share preview, validates eligibility, and calls a server endpoint to submit.
2) **Server handler** generates PNG from a deterministic SVG (or equivalent), uploads to Reddit media, and submits a custom post with `entry: 'share'`, `userGeneratedContent.imageUrls`, `textFallback`, and `postData`.
3) **Shared post rendering** uses `postData` only (image URL + payload) and never depends on Redis.

## Workstreams

### 0) Baseline Audit (short)
- Identify current share entry points, service methods, and any residual markdown-only share flow.
- Confirm where the result screen layout is defined (for screenshot capture or SVG export).
- Locate current server build/bundle scripts and ensure they work with the Devvit web app stack.

Deliverable: short list of files/modules to touch and any blockers (TypeScript build, bundle config, or API mismatches).

### 1) Define Share Payload Contract
- Add a `SharePayload` shape (client + server), max 2 KB postData:
  - `entry: 'share'`, `responseId`, `riddleId`, `username`, `decision`, `score`, `riddleText`, `answer`, `feedbackSnippet`, `shareImageUrl`, `createdAt`.
- Add a truncation helper to enforce the 2 KB limit before submission.
- Add a text fallback builder mirroring the payload (readable without the image).

Acceptance:
- `postData` size guard in place; payload renders correctly without Redis.

### 2) Generate the Share Image (PNG)
- Choose the screenshot source:
  - Preferred: server-side SVG renderer for the result card (deterministic, no client dependency).
  - Alternative: render in the web client and send SVG to server for conversion.
- Convert SVG to PNG server-side and guard against size > 20 MB.
- If conversion fails, proceed with text-only share and log telemetry (do not block posting).

Acceptance:
- PNG upload succeeds and produces a Reddit-hosted image URL; fallback path works.

### 3) Server Submit Handler (Pixelary-style)
- Implement `/api/share/submit`:
  - Input: share payload + SVG (if needed).
  - `media.upload` PNG; use returned URL in `userGeneratedContent.imageUrls`.
  - Call `reddit.submitCustomPost({ entry: 'share', runAs: 'USER', userGeneratedContent, postData, textFallback })`.
  - Return `postId`, `permalink`, `shareImageUrl`.
- Ensure server bundle is built and does not import runtime-only packages.

Acceptance:
- Server logs show `boot`, `request`, `submitted`, and the client receives `postId/permalink`.

### 4) Client Share Flow Updates
- Update the share CTA to call the server endpoint and pass payload + SVG.
- Enforce eligibility guards in UI and server (score > 0, not already shared).
- Ensure the async handler awaits submission so navigation happens inside the UI event.
- Persist `postId`, `permalink`, and `shareImageUrl` on the response after success.

Acceptance:
- Share CTA posts an image-backed custom post and navigates to the permalink.

### 5) Shared Post Rendering (Inline)
- Update the main entry renderer to detect `postData.entry === 'share'` (or payload fields) and render a share-only view.
- Do not register a new custom post type as a front door.
- Render from `postData` only (image + text) and guard for missing fields.

Acceptance:
- Opening the permalink renders the share view even with Redis disabled.

### 6) Telemetry + Error UX
- Log `attempt/success/failure` with error details and payload identifiers.
- Present permission-denied errors clearly (`runAs: 'USER'` scopes missing).
- Retry path keeps payload data in memory; show an “Open post” fallback button if navigation fails.

Acceptance:
- Errors are visible, retryable, and leave the app in a stable state.

## Build & Tooling Plan
- Confirm/restore a working server bundle pipeline (esbuild or equivalent) to emit `dist/server/index.js` (or `.cjs`) without runtime package imports.
- Ensure `devvit.json` points to the bundled server entry.
- Keep `tsc` typecheck green for the web client and server code.

## Test Plan (manual)
- Happy path: eligible share → image preview renders in feed → permalink opens share view.
- Permission denied: missing `runAs: 'USER'` scopes → CTA blocked + error message.
- Image failure: force PNG conversion error → post still created with text fallback.
- Duplicate: second share attempt for same response blocked (UI + server).
- Zero score: CTA disabled.
- Cache miss: simulate Redis unavailable; share view still renders from `postData`.

## Open Questions
- What is the authoritative result-card layout source for server-side rendering (existing SVG, component render, or a new template)?
- Do we want to allow a temporary client-rendered SVG export while server-side SVG rendering is being built?
- Do we need to support internationalization in the share payload fields (title/fallback text)?

## Suggested Milestones
1) Payload contract + text fallback + truncation helper.
2) Server handler + bundle working; happy-path share from a test payload.
3) UI integration (CTA, guards, navigation) and persistence.
4) Share view render from `postData` and full manual test pass.
