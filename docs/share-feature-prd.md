# Debattle Share Feature PRD

## Objective & Scope
- Enable players to share a finished Debattle round as a Reddit post that shows their riddle, answer, decision (open/ajar/closed), and a feedback snippet. Sharing is available for all non-zero scores and limited to one share per response.
- Post title format is fixed: `This is <user-name> answer. What is yours?`
- After posting, the player is taken to the created post so they can comment or view it.

## Success Criteria
- Posts render with the generated share card image and fallback text containing riddle, answer, decision, and feedback snippet.
- Share is prevented for zero-score responses and for already-shared responses.
- On success, the user sees confirmation and is deep-linked to the post. On failure (upload or posting), the user sees an error with a retry option.

## User Flow
- From Result: Player finishes a round and sees the Share preview (read-only).
- Guardrails: If score is 0 or the response was already shared, the Post CTA is disabled with messaging.
- Post: On tap/click, we create the post (as the user, with media card + fallback text). On success, store postId/permalink/imageUrl.
- Navigate: Auto-navigate the player to the created post. Offer a success toast if available.
- Failure: If media upload or posting fails, show an error and a retry CTA; preserve context to retry without re-answering.

## Functional Requirements
- Content:
  - Card and fallback text must include: riddle text, user answer, decision (open/ajar/closed), feedback snippet. Username is shown in title as provided format.
  - Fallback text must be meaningful if the image fails to load in clients.
- Eligibility:
  - Allow sharing only when score > 0 and the response is not yet shared (one share per response).
- Posting:
  - Post title: `This is <user-name> answer. What is yours?`
  - Use media upload for the share card image (PNG). Include image URL in the post payload so the preview renders.
  - Posting path: server/web handler calling `submitCustomPost` with `entry: 'share'`, `postData`, and `imageUrls` (Pixelary-style); do not rely on Blocks `submitPost` for previews.
  - Run as user-generated content; if `runAs: 'USER'` permission is denied, block the share (no app-post/comment fallback).
  - Destination: always the installed subreddit (no selection or crosspost).
  - Include textFallback/post body summarizing riddle, answer, decision, and feedback snippet.
- State:
  - Persist postId, permalink, and shareImageUrl on the response.
- Telemetry:
  - Log share attempts, successes, and failures in Redis for analysis.
- Navigation/UX:
  - On success: toast (if available) and auto-navigate to the permalink.
  - On failure: surface clear error and retry CTA.

## Non-Functional & Limits
- Rate limiting: max one share per response. Consider daily caps if needed.
- Media constraints: PNG/JPEG ≤ 20 MB; ensure SVG→PNG encoder is ready before upload.
- PostData size (if using custom posts): enforce ≤ 2 KB via truncation.

## Out of Scope
- Multiple front-door post types (keep Install/Pinned as the only entry).
- Editing share content in the preview.
