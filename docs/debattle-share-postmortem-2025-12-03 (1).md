# Debattle Share Freeze Postmortem — 2025-12-03

## Summary
Sharing a round to the subreddit regressed: the UI froze on “Sharing…”, and viewing shared posts showed “Unable to load shared riddle.” Attempts to redesign the share flow added a custom post entry and media upload, but cache misses and embedded data gaps prevented the shared view from loading.

## Impact
- Players could not reliably share rounds; the share spinner persisted.
- Shared posts in the subreddit failed to render, showing an error screen instead of the parchment preview.

## Timeline (UTC)
- 2025-12-02: Initial report of freeze after Share; shared posts only visible after refresh and rendered as live app.
- 2025-12-03: Implemented static SVG preview + custom post entry + media upload; runtime errors (“Devvit is not defined”) triggered resets.
- 2025-12-03: Cache misses on shared post load; embedded share data not always present; repeated fallback attempts; ultimately reverted changes per request.

## Root Causes
- Shared post view depended on Redis cache; shared posts didn’t consistently embed share data, so post load failed when cache missed.
- Custom post submission path not fully supported/falling back; inconsistent inclusion of postData led to missing embedded share record.
- Repeated code edits introduced runtime errors (`Devvit` undefined) causing app restarts and persistent “Sharing…” state.

## What Went Well
- Added logging around share submission and cache fetches, revealing cache misses and postId normalization issues.
- Scoped reversion plan avoided disturbing unrelated user changes.

## What Went Wrong
- Swapped share pipeline without confirming postData support/fallback behavior in the current Devvit version.
- Introduced new files/paths without ensuring HEAD had those files (SharedPostView, share.ts absent in repo).
- Media upload + custom post entry shipped simultaneously, increasing failure surface.

## Remediation / Follow-ups
- Keep shared post rendering self-contained: always embed share payload in postData and render from it, with Redis only as a cache.
- If custom post is unavailable, skip experience previews entirely and use a hosted image post instead; confirm postData support in the fallback API.
- Add guardrails for Devvit imports in any new JSX files to prevent runtime crashes.
- Stage changes incrementally with feature flags to isolate failures.

## Current Status
- Changes reverted to pre-investigation state per user request. Further fixes to be re-attempted with a smaller, validated patch set.
