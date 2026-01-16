# Sharing Feature Research (Reddit/Devvit)

## Pixelary (drawing & guessing game on Reddit)
- Sources: [Knut Synstad case study](https://www.knutsynstad.com/projects/pixelary), [Devvit blog: “Inside Pixelary”](https://developers.reddit.com/docs/blog/pixelary), [debattle postmortem notes](docs/debattle-share-postmortem-2025-12-03%20(2).md), [Pixelary source](https://github.com/reddit/devvit-pixelary/tree/main).
- Mechanics: Built with Devvit Blocks; asynchronous play (draw → creates a post, guess → comment). Blog highlights “content flywheel”: every drawing spawns a fresh post, guesses/comments boost distribution.
- First-impression emphasis: Blog stresses making the inline view visually fresh per post to avoid “repost fatigue,” implying shared renders must be unique and scannable in-feed.
- Build topology (from Pixelary repo `devvit.json` + `src/server/tsconfig.json`): separate client and server bundles (`post.dir: dist/client`, `server.dir: dist/server`, `server.entry: index.cjs`). This indicates Pixelary runs a dedicated server bundle rather than relying on Blocks-only posting, aligning with a “proper server build” approach (not a UI-only workaround).
- Sharing path (as used in Pixelary-style implementations and noted in our postmortem): use a server/web handler (not Blocks) to call `reddit.submitCustomPost({ entry: 'share', runAs: 'USER', userGeneratedContent.imageUrls, postData, textFallback })`. This avoids the Blocks limitation where `submitCustomPost` is unavailable. Share cards are generated server-side, uploaded via `media.upload`, and posted as user-generated content with `postData` embedded so the shared view can render without cache hits.
- Operational lessons from blog/postmortem alignment:
  - Embed state in the post (`postData`) so the shared view renders offline from cache failures.
  - Keep share entry unregistered as a “front door” to prevent the share surface from hijacking the subreddit’s main entry.
  - Provide clear success feedback (toast/navigation) after posting so the preview doesn’t appear frozen.
- Additional insights from the Pixelary repo (`src/server/core/post.ts`, `src/server/services/posts/drawing.ts`, `tournament/post.ts`):
  - Custom post creation enforces a 2 KB `postData` limit before calling `submitCustomPost` and maps entries per type (`drawing`, `collection`, `pinned`, `tournament`). Drawings/collections post `runAs: 'USER'`, others default to app. `userGeneratedContent` always includes text plus optional image URL, and a “transparent” splash is set to avoid the default pattern.
  - Drawing posts render a PNG server-side (`encodeDrawingToPngDataUrl`) and upload via `media.upload({ type: 'image' })`; failures are caught so the post still publishes without an image. The uploaded image is threaded into `userGeneratedContent.imageUrls` for richer previews.
  - Tournament submissions upload the drawing snapshot, then post a markdown comment `[My submission](mediaUrl)` with `runAs: 'USER'`; entries are rate-limited and hydrated into Redis for later rendering. This shows a hybrid: media upload + comment share when a full custom post isn’t needed.

## Other Reddit apps/games with sharing mechanics
- **Bingo (Devvit sample app)** – https://github.com/reddit/devvit/blob/main/packages/apps/bingo/src/components/App.tsx
  - Flow: Shows confirmation modal → syncs board state to Redis → builds a visual board snapshot as emoji (`🟩/🟥`) → posts a comment via `context.reddit.submitComment` on the current post → stores `permalink` and optional `navigateTo` link → shows success modal.
  - UX choices: separates confirmation and success modals, prevents sharing when user not logged in, reuses cached state via `useInterval` to avoid stale shares, and uses text-only richtext (no media upload required).
  - Takeaway: Comment-based sharing is the lowest-friction pattern when image upload or custom posts are unavailable; success UX matters even for lightweight shares.
- **Live-scores / community-hub / payments-example** samples submit posts programmatically (`reddit.submitPost`) with `preview` blocks. While not “share” flows, they show server-driven post creation patterns with `runAs` and `postData` that mirror what a share pipeline would use for user-generated posts.

## Devvit documentation best practices relevant to sharing
- **User actions (docs/capabilities/server/userActions.md)**  
  - Use `runAs: 'USER'` to post/comment as the player; requires explicit permissions (`SUBMIT_POST`, `SUBMIT_COMMENT`, `SUBSCRIBE_TO_SUBREDDIT`) and user opt-in.  
  - `userGeneratedContent` is required for `submitPost`/`submitCustomPost` when `runAs: 'USER'` to pass safety/compliance review.  
  - Transparency: show users exactly what will be posted and how to opt out.
- **Media uploads (docs/capabilities/server/media-uploads.mdx)**  
  - Enable `permissions.media: true`.  
  - Only Reddit-hosted images are allowed; upload via `media.upload({ url, type })` to get a Reddit URL.  
  - Supported types: GIF, PNG, JPEG; max 20 MB. Good fit for generated share cards converted to PNG.
- **Submit post API (docs/api/redditapi/RedditAPIClient/classes/RedditAPIClient.md)**  
  - Example shows `submitPost` with `runAs: RunAs.USER`, `userGeneratedContent: { text, imageUrls }`, and `textFallback` + `preview`.  
  - Recommendation: always include `textFallback` so shares degrade gracefully in markdown-only contexts; include `imageUrls` when posting media cards.
- **Entry points / view modes (docs/capabilities/server/launch_screen_and_entry_points/view_modes_entry_points.md)**  
  - Use `entry` to target a share-specific entry point; keep inline view light and user-initiated expansion.  
  - Performance and gesture rules apply to share previews shown inline (fast load, tap-only interactions).

## Implications & recommended patterns for Debattle’s share feature
- Prefer server-side share submission using `submitCustomPost` with `runAs: 'USER'`, `userGeneratedContent.imageUrls`, and embedded `postData` (Pixelary-style) to ensure the shared view renders without external cache calls.
- Generate share cards as PNGs → upload with `media.upload` (respect 20 MB / PNG/JPEG/GIF limits) → pass returned Reddit URL into `userGeneratedContent.imageUrls` and markdown fallback.
- Always provide `textFallback` summarizing the shared round (title + score + CTA) so non-interactive contexts show something meaningful.
- Add explicit confirmation + success UX (modal/toast + navigate-to-permalink) to avoid the “frozen preview” problem noted in the postmortem.
- If server/web context is unavailable, use a comment-based fallback (Bingo pattern): render text/emoji summary, post via `submitComment`, and surface the permalink.
- Store user opt-in state for posting as the user; surface transparency per user-actions guidelines.
- Keep the share entry unregistered as a main entry point to avoid hijacking the subreddit feed; render it only when the user opens the shared post/permalink.

## Quick source references
- Pixelary case study: https://www.knutsynstad.com/projects/pixelary  
- Pixelary Devvit blog: https://developers.reddit.com/docs/blog/pixelary  
- Devvit user actions: https://developers.reddit.com/docs/capabilities/server/userActions  
- Devvit media uploads: https://developers.reddit.com/docs/capabilities/server/media-uploads  
- Devvit submitPost (with `userGeneratedContent`): https://developers.reddit.com/docs/api/redditapi/RedditAPIClient/classes/RedditAPIClient  
- Devvit entry points / view modes: https://developers.reddit.com/docs/capabilities/server/launch_screen_and_entry_points/view_modes_entry_points  
- Bingo share example: https://github.com/reddit/devvit/blob/main/packages/apps/bingo/src/components/App.tsx
