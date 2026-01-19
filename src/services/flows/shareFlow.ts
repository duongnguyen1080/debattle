import type { RedditAPIClient } from '@devvit/public-api';
import type { RiddleFlow } from './riddleFlow.js';

export interface ShareResponseParams {
  riddleId: string;
  responseId: string;
  questionText: string;
  answerText: string;
  playerUsername: string;
  totalScore: number;
  decision: 'open' | 'ajar' | 'closed';
  feedback: string;
  subredditName?: string;
}

export interface ShareResponseResult {
  postId: string;
  permalink?: string;
}

export interface ShareFlow {
  shareResponseToSubreddit(params: ShareResponseParams): Promise<ShareResponseResult>;
}

export function decisionSummary(decision: 'open' | 'ajar' | 'closed'): { label: string; emoji: string } {
  switch (decision) {
    case 'open':
      return { label: 'Door swings open', emoji: '\uD83D\uDFE2' };
    case 'ajar':
      return { label: 'Door stands ajar', emoji: '\uD83D\uDFE1' };
    default:
      return { label: 'Door remains sealed', emoji: '\uD83D\uDD34' };
  }
}

export function createShareFlow(deps: {
  reddit: RedditAPIClient;
  riddleFlow: RiddleFlow;
  resolveSubredditName: (explicit?: string) => Promise<string>;
}): ShareFlow {
  const { reddit, riddleFlow, resolveSubredditName } = deps;

  const buildShareModMessage = (params: {
    totalScore: number;
    decision: 'open' | 'ajar' | 'closed';
    feedback: string;
  }): string => {
    const { totalScore, decision, feedback } = params;
    const scoreValue = Number.isFinite(totalScore) ? Math.round(totalScore) : 0;
    const decisionLabel = decisionSummary(decision).label;
    const feedbackText = feedback?.trim() || 'No feedback from Arete.';
    return [
      'Debattle is a Ravenclaw-inspired riddle game: instead of logic puzzles, you face philosophical riddles to "open the door." There\'s no right or wrong - Arete, the gatekeeper, rewards thoughtful answers.',
      '',
      `- Score: ${scoreValue}`,
      `- Decision: ${decisionLabel}`,
      `- Feedback from Arete: ${feedbackText}`,
      '',
      "Share your take on the riddle and whether you agree with the player's response. No scores here - just deeper thoughts about life.",
    ].join('\n');
  };

  const shareResponseToSubreddit = async (params: ShareResponseParams): Promise<ShareResponseResult> => {
    const {
      riddleId,
      responseId,
      questionText,
      answerText,
      playerUsername,
      totalScore,
      decision,
      feedback,
      subredditName,
    } = params;

    console.log('[Service.shareResponseToSubreddit] start', {
      riddleId,
      responseId,
      subredditName: subredditName ?? null,
      totalScore,
      decision,
      questionLength: questionText?.length ?? 0,
      answerLength: answerText?.length ?? 0,
      feedbackLength: feedback?.length ?? 0,
    });

    const riddle = await riddleFlow.getRiddle(riddleId);
    if (!riddle) {
      console.warn('[Service.shareResponseToSubreddit] riddle not found', { riddleId });
      throw new Error('Riddle not found');
    }

    const response = riddle.responses.find((resp) => resp.id === responseId);
    if (!response) {
      console.warn('[Service.shareResponseToSubreddit] response not found', { riddleId, responseId });
      throw new Error('Response not found');
    }

    if (response.postId) {
      console.log('[Service.shareResponseToSubreddit] already shared', {
        riddleId,
        responseId,
        postId: response.postId,
      });
      try {
        const existing = await reddit.getPostById(response.postId);
        console.log('[Service.shareResponseToSubreddit] existing post lookup ok', {
          postId: response.postId,
          permalink: existing?.permalink ?? null,
        });
        return { postId: response.postId, permalink: existing?.permalink };
      } catch (err) {
        console.warn('[Service.shareResponseToSubreddit] response already shared but lookup failed', err);
        return { postId: response.postId };
      }
    }

    const resolvedSubreddit = await resolveSubredditName(subredditName);
    const sanitizedUsername = (playerUsername || 'anonymous').replace(/^u\//i, '');
    const title = questionText;

    // Follow Devvit "share to subreddit" guidance: create a self-post with markdown payload.
    const postBody = answerText;
    console.log('[Service.shareResponseToSubreddit] submitting post', {
      subredditName: resolvedSubreddit,
      titleLength: title.length,
      bodyLength: postBody.length,
      playerUsername: sanitizedUsername,
      decision,
      responseId,
      runAs: 'USER',
    });
    const post = await reddit.submitPost({
      subredditName: resolvedSubreddit,
      title,
      text: postBody,
      runAs: 'USER',
    });
    console.log('[Service.shareResponseToSubreddit] submitPost ok', {
      postId: post.id,
      permalink: post.permalink ?? null,
      authorName: post.authorName ?? null,
      approved: post.approved,
      spam: post.spam,
      removed: post.removed,
      removedByCategory: post.removedByCategory ?? null,
    });
    if (!post.approved && (post.spam || post.removed || post.removedByCategory)) {
      try {
        await post.approve();
        console.log('[Service.shareResponseToSubreddit] post approved', { postId: post.id });
      } catch (err) {
        console.warn('[Service.shareResponseToSubreddit] post approval failed', err);
      }
    }
    const modMessage = buildShareModMessage({ totalScore, decision, feedback });
    try {
      const comment = await reddit.submitComment({
        id: post.id,
        text: modMessage,
        runAs: 'APP',
      });
      console.log('[Service.shareResponseToSubreddit] mod comment posted', {
        postId: post.id,
        commentId: comment.id,
      });
    } catch (err) {
      console.warn('[Service.shareResponseToSubreddit] mod comment failed', err);
    }

    response.postId = post.id;
    try {
      await riddleFlow.saveRiddle(riddle);
      console.log('[Service.shareResponseToSubreddit] persisted postId', {
        riddleId,
        responseId,
        postId: post.id,
      });
    } catch (err) {
      console.error('[Service.shareResponseToSubreddit] failed to persist postId', err);
    }

    return { postId: post.id, permalink: post.permalink };
  };

  return { shareResponseToSubreddit };
}
