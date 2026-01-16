# Debattle Share Flow Postmortem (2025-12-03)

## Summary
Attempts to ship a Pixelary-style share flow stalled because the Blocks runtime lacks `submitCustomPost`, and the fallback `submitPost` path never rendered the PNG preview. Multiple implementations were tried and reverted; playtests showed markdown-only posts, frozen UI after sharing, and playtest surface confusion when an extra share post type was registered.

## Impact
- Shared posts are markdown-only; no PNG preview.
- Users see a frozen preview after sharing (no auto-navigation/toast; stays on preview).
- Playtest confusion when an extra post type was registered (since reverted).

## Timeline of changes and fallout
- Added PNG generation (svg2png-wasm); asset upload failed (MIME), so WASM was embedded. Encoding works; posting remains broken.
- Registered a “Share Post” custom post type + SharePostEntry; playtest defaulted to it (no postData/image), showing “Shared post unavailable” and breaking the perceived main flow. **Reverted** to a single front door (Install Game).
- Upgraded Devvit packages; `context.reddit.submitCustomPost` still unavailable in Blocks → runtime errors; weighed server vs Blocks fallback.
- Added `userActions: true` to Devvit.configure for `runAs: 'USER'`.
- Switched to `submitPost` fallback with markdown + `userGeneratedContent.imageUrls`; posts rendered markdown only (PNG ignored), UI appeared frozen after share (no success nav/toast).
- Tried `RichTextBuilder` to embed PNG; paragraph callbacks failed (`cb is not a function`, `p.rawText is not a function`). **Reverted** to markdown-only `submitPost`.
- Fixed toast binding in useRoundFlow so length-limit warnings display again.

### Options considered for submitCustomPost gap (from convo)
- **Path 1 (server-side, Pixelary-style):** Add a server/web handler with the server reddit client, call `submitCustomPost({ entry: 'share', runAs: 'USER', userGeneratedContent.imageUrls, postData, textFallback })`, invoked from UI. Requires server context + reddit permission; yields custom entry posts with static card + CTA.
- **Path 2 (Blocks fallback, chosen but failed):** Use `context.reddit.submitPost` with uploaded PNG (richtext/preview), `userGeneratedContent`, `runAs: 'USER'`, plus postData/textFallback. Intended to produce a static image post without a live app, but the image did not render, richtext attempts errored, and UI stayed frozen.

### Other option points (from convo)
- WASM asset issue: Option 1 rename/upload as an asset (failed MIME/upload); Option 2 embed WASM bytes in code (chosen; encoder loads, but posting still broken).
- Share entry takeover: Option 1 keep separate share custom post type (caused playtest to land on empty share surface); Option 2 remove extra front-door post type and keep only Install/Pinned (chosen to stabilize playtest).

## Root causes
- Blocks context does not expose `submitCustomPost`; Pixelary uses a server/web client that does.
- `submitPost` in Blocks ignored the uploaded image for preview; richtext/preview API usage is unclear or unsupported in this SDK version.
- Registering a separate share post type caused playtest to land on the wrong surface when empty.
- Missing success-state handling leaves the share preview looking frozen after share.

## Current status 
- Share pipeline: gathers data, renders PNG, uploads, calls `submitPost` (markdown-only), stores `postId/permalink/imageUrl`. No custom entry; no image preview; UI still lacks success navigation and stays on the preview.
- Only Install Game custom post type is registered (share entry component exists but is unregistered to avoid takeover).
- userActions enabled; `submitCustomPost` still unavailable in Blocks runtime.

## Lessons learned
- Confirm API availability in the active runtime (Blocks vs server/web) before choosing the posting method.
- Avoid multiple front-door custom post types in playtest; they can hijack the default surface.
- Favor documented/verified richtext/preview patterns when `submitCustomPost` is unavailable, and add explicit success-state navigation to prevent “frozen” UX.

## Remediation / Follow-ups
1) Keep a single front-door custom post type (Install/Pinned) to avoid surface hijack (done).
2) Choose a working post path:
   - Blocks fallback: only if a verified richtext/preview pattern renders the PNG in this SDK (include `textFallback`, `runAs: 'USER'`, userActions enabled).
   - Server path (Pixelary-style): add a server handler to call `submitCustomPost` with `entry: 'share'`, image + postData/textFallback; UI invokes it.
3) UX: on share success, clear `isSharing`, store `sharePostId/permalink`, toast success, and navigate to the permalink to avoid a frozen preview.
4) If using the server path, keep the share entry unregistered as a front door; it should render only when opened via the shared post.