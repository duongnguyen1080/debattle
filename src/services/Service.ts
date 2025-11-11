import { RedisClient, RedditAPIClient, AppUpgrade, TriggerContext } from '@devvit/public-api';
import { User, Guess, Theme, LeaderboardEntry, RiddleV2, PlayerResponse, AreteEvaluation } from '../types/index.js';
import { calculateLevel, getFlairForLevel, calculateGuessScore } from '../utils/gameUtils.js';
import { calculatePostBonusFromUpvotes } from '../utils/gameUtils.js';
import { getRandomQuestion, QuestionBankEntry } from '../utils/questionBank.js';

const ARETE_SYSTEM_PROMPT = `You are the Guardian of the Arete Gate, keeper of wisdom and judge of truth.
Your task is to evaluate the wanderer’s answer to decide if the gate shall open — and how many points they deserve.

Read the question and the answer carefully.
Then evaluate based on the five criteria below.

1. Relevance (Yes / No — STRICT)
Does the answer clearly respond to the idea or subject of the question?
Does it share a logical or thematic connection to the question?
Would a reasonable reader say, "Yes, this directly answers that question"?
If the answer merely sounds philosophical but does not logically or semantically relate to the question, mark "No."
If the answer reuses memorized or generic moral statements without touching the question’s topic, mark "No."
When judging Relevance, compare meanings directly. If the answer does not clearly engage with the question’s idea, score No even if it sounds deep or poetic.
Profound tone ≠ relevance; logical connection is required.
If Yes → award 50 points and continue to the next criteria.
If No → award 0 points and return only this feedback: "Stay Concise".

2. Completeness (1–10)
How fully does the answer explore and satisfy the question?
1–2: Extremely incomplete or fragmentary; gives no real reasoning or insight.
3–4: Touches part of the question but leaves most unaddressed; lacks development.
5–6: Addresses the main idea but misses depth or supporting reasoning.
7–8: Covers most aspects clearly, with good supporting thought; minor gaps.
9–10: Thorough, well-reasoned, and leaves the reader feeling fully satisfied.

3. Clarity (1–10)
How easy is it to understand?
1–2: Disorganized, confusing, or grammatically broken.
3–4: Roughly understandable but with unclear logic or phrasing.
5–6: Generally clear but has awkward structure or minor confusion.
7–8: Smooth, logically structured, easy to follow.
9–10: Exceptionally clear, elegant, and effortless to read.

4. Originality (1–10)
How unique or authentic is the thought?
1–2: Cliché, copied, or entirely generic.
3–4: Predictable or derivative; minimal personal thinking.
5–6: Some individuality, but familiar reasoning.
7–8: Fresh and personal perspective with clear insight.
9–10: Deeply original; feels like a new way of seeing the question.

5. Aesthetic (1–10)
How beautifully or expressively is it written?
1–2: Flat or clumsy language; no emotional tone.
3–4: Simple phrasing; functional but dull.
5–6: Some rhythm or imagery but uneven expression.
7–8: Graceful style; pleasing flow or subtle emotion.
9–10: Lyrical, poetic, or literary; evokes beauty or depth of feeling.

Scoring & Feedback
Max score: 90 points (50 + 10 + 10 + 10 + 10).
If Relevance = No → return only feedback "Stay Concise" and set totalPoints to 0.
Otherwise, return the sum of all points and a short praise based on which criterion (2–5) has the highest score (tie-break priority: Completeness > Clarity > Originality > Aesthetic):
Completeness → "Impeccably detailed!"
Clarity → "Perfectly lucid!"
Originality → "Brilliantly unique!"
Aesthetic → "Beautiful expression!"

Output Requirements
- Always respond with minified JSON only (no markdown or prose).
- When relevance is "Yes", include the keys relevance, completeness, clarity, originality, aesthetic, totalPoints, and feedback.
- When relevance is "No", respond exactly with {"relevance":"No","totalPoints":0,"feedback":"Stay Concise"}.`;

export class Service {
  constructor(
    private redis: RedisClient,
    private reddit: RedditAPIClient,
    private opts?: { getSetting?: (key: string) => Promise<string | null | undefined> }
  ) {}

  // --- AI integration (OpenAI) ---
  // Uses OpenAI Chat Completions. Domain is on Devvit's allowlist.
  // Key via env: OPENAI_API_KEY
  private get aiProvider(): 'openai' | 'anthropic' {
    return 'openai';
  }

  private get openaiModel(): string {
    // pick a solid default; you can override via OPENAI_MODEL
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  private clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)); }

  // Normalize storage key for riddles. Accepts either bare id ("123:abc") or
  // already-prefixed id ("riddle:123:abc") and returns a Redis key that won't
  // double-prefix.
  private riddleKey(id: string): string {
    return id.startsWith('riddle:') ? id : `riddle:${id}`;
  }

  private extractJSON(s: string): any {
    // Try to parse plain JSON or ```json fenced blocks
    const fence = /```json\s*([\s\S]*?)```/i;
    const m = fence.exec(s);
    const raw = m ? m[1] : s;
    return JSON.parse(raw);
  }


  private async callOpenAI(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    systemPrompt: string = '',
    timeoutMs: number = 20000
  ): Promise<string> {
    const getSetting = this.opts?.getSetting;
    const apiKey =
      process.env.OPENAI_API_KEY ||
      (getSetting ? await getSetting('OPENAI_API_KEY') : undefined) ||
      (getSetting ? await getSetting('openaiApiKey') : undefined) ||
      '';
    const model =
      process.env.OPENAI_MODEL ||
      (getSetting ? await getSetting('OPENAI_MODEL') : undefined) ||
      (getSetting ? await getSetting('openaiModel') : undefined) ||
      this.openaiModel;

    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 512,
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      return String(content);
    } finally {
      clearTimeout(to);
    }
  }

  // Evaluate an answer using the Arete Gate rubric (relevance + four criteria + praise)
  async evaluateAnswerWithAI(questionText: string, answerText: string): Promise<AreteEvaluation> {
    const system = ARETE_SYSTEM_PROMPT;
    const evaluationPrompt = `Question:\n${questionText}\n\nAnswer:\n${answerText}\n\nEvaluate the answer using the Arete Gate rubric and return only the required JSON.`;
    const evaluationMessages = [{ role: 'user' as const, content: evaluationPrompt }];
    const defaultResult: AreteEvaluation = {
      relevance: 'No',
      completeness: 0,
      clarity: 0,
      originality: 0,
      aesthetic: 0,
      totalPoints: 0,
      feedback: 'Stay Concise',
    };

    try {
      const raw = await this.callOpenAI(evaluationMessages, system, 20000);

      const obj = this.extractJSON(raw);
      const relevanceRaw = typeof obj.relevance === 'string' ? obj.relevance.trim() : 'No';
      const isRelevant = /^y(es)?$/i.test(relevanceRaw);
      const cleanFeedback = (value: unknown, fallback: string) => {
        const text = typeof value === 'string' ? value.trim() : '';
        return text || fallback;
      };

      if (!isRelevant) {
        return {
          relevance: 'No',
          completeness: 0,
          clarity: 0,
          originality: 0,
          aesthetic: 0,
          totalPoints: 0,
          feedback: cleanFeedback(obj.feedback, 'Stay Concise'),
        };
      }

      const clampScore = (value: unknown) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.round(this.clamp(num, 0, 10));
      };

      const completeness = clampScore(obj.completeness);
      const clarity = clampScore(obj.clarity);
      const originality = clampScore(obj.originality);
      const aesthetic = clampScore(obj.aesthetic);
      const totalPoints = Math.round(this.clamp(50 + completeness + clarity + originality + aesthetic, 0, 90));
      const praiseOrder = [
        { score: completeness, phrase: 'Impeccably detailed!' },
        { score: clarity, phrase: 'Perfectly lucid!' },
        { score: originality, phrase: 'Brilliantly unique!' },
        { score: aesthetic, phrase: 'Beautiful expression!' },
      ];
      const bestPraise = praiseOrder.reduce((best, current) => (current.score > best.score ? current : best), praiseOrder[0]);
      const feedback = cleanFeedback(obj.feedback, bestPraise.phrase);

      return { relevance: 'Yes', completeness, clarity, originality, aesthetic, totalPoints, feedback };
    } catch (err) {
      console.error('evaluateAnswerWithAI failed:', err);
      return defaultResult;
    }
  }
  // --- end AI integration ---

  // User Management
  async getUser(username: string): Promise<User | null> {
    const raw = await this.redis.hGet('users', username);
    if (!raw) return null;
    try {
      const user: User = JSON.parse(raw);
      user.level = calculateLevel(user.xp);
      user.flair = getFlairForLevel(user.level);
      return user;
    } catch {
      return null;
    }
  }

  async createUser(username: string): Promise<User> {
    const user: User = {
      username,
      xp: 0,
      level: 1,
      flair: '🌱 Novice Debattler',
      riddlesCreated: 0,
      riddlesSolved: 0,
      totalUpvotes: 0,
      joinDate: Date.now()
    };
    
    await this.redis.hSet('users', { [username]: JSON.stringify(user) });
    return user;
  }

  async updateUserXp(username: string, xpGained: number): Promise<User> {
    let user = await this.getUser(username);
    if (!user) {
      user = await this.createUser(username);
    }
    
    const oldLevel = user.level;
    user.xp += xpGained;
    user.level = calculateLevel(user.xp);
    user.flair = getFlairForLevel(user.level);
    
    await this.redis.hSet('users', { [username]: JSON.stringify(user) });
    
    // Check if user leveled up
    if (user.level > oldLevel) {
      await this.handleUserLevelUp(username, user);
    }
    
    return user;
  }

  async handleUserLevelUp(username: string, user: User): Promise<void> {
    // Send congratulatory message
    try {
      await this.reddit.sendPrivateMessage({
        to: username,
        subject: `🎉 Level Up! You're now a ${user.flair}!`,
        text: `Congratulations! You've reached level ${user.level} and earned the title: ${user.flair}\n\nKeep creating and solving riddles to reach even higher levels!`
      });
    } catch (error) {
      console.error('Failed to send level up message:', error);
    }
  }

  // Riddle Management
  async createRiddleFromTheme(params: { theme: string; playerUsername: string; question?: QuestionBankEntry }): Promise<RiddleV2 | null> {
    const { theme: requestedTheme, playerUsername, question: providedQuestion } = params;
    console.log('[Service.createRiddleFromTheme] start', { requestedTheme, playerUsername });
    try {
      // Use a bare id for the model id; Redis keys will be prefixed via riddleKey().
      const id = `${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
      const now = Date.now();
      const expiresAt = now + 24 * 60 * 60 * 1000; // 24h
      const question = providedQuestion ?? getRandomQuestion();
      const riddleText = question.question || `On the theme of ${question.theme}: What do you owe to yourself that cannot be owned?`;

      const riddle: RiddleV2 = {
        id,
        meta: {
          theme: question.theme,
          riddleText,
          questionId: question.id,
          requestedTheme,
        },
        authorUsername: playerUsername,
        createdAt: now,
        expiresAt,
        status: 'active',
        responses: [],
      };

      console.log('[Service.createRiddleFromTheme] persisting');
      await this.redis.set(this.riddleKey(id), JSON.stringify(riddle));
      const active = await this.getActiveRiddles();
      const next = Array.isArray(active) ? [...active, id] : [id];
      await this.redis.set('riddles:active', JSON.stringify(next));
      console.log('[Service.createRiddleFromTheme] done', { id });
      return riddle;
    } catch (e) {
      console.error('[Service.createRiddleFromTheme] error', e);
      return null;
    }
  }

  async getRiddle(id: string): Promise<RiddleV2 | null> {
    const raw = await this.redis.get(this.riddleKey(id));
    if (!raw) return null;
    try { return JSON.parse(raw) as RiddleV2; } catch { return null; }
  }

  async submitAnswer(params: { riddleId: string; playerUsername: string; answerText: string; elapsed: number }): Promise<{
    score: { wit: number; logic: number; style: number; total: number };
    feedback: string;
    decision: 'open' | 'ajar' | 'closed';
    responseId: string;
    areteEvaluation?: AreteEvaluation;
  }> {
    const { riddleId, playerUsername, answerText, elapsed } = params;
    const riddle = await this.getRiddle(riddleId);
    if (!riddle || riddle.status !== 'active') {
      throw new Error('Riddle not found or inactive');
    }

    const trimmed = answerText.trim();
    const elapsedMs = this.clamp(Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0, 0, 10 * 60 * 1000);
    const wordTokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const uniqueWords = new Set(trimmed.toLowerCase().match(/\b[a-z']+\b/g) ?? []);
    const connectors = (trimmed.match(/\b(because|therefore|thus|hence|so|consequently)\b/gi) ?? []).length;
    const punctuationMarks = (trimmed.match(/[,:;—–-]/g) ?? []).length;
    const sentenceCount = (trimmed.match(/[.!?]+/g) ?? []).length || (trimmed ? 1 : 0);

    const witBase = uniqueWords.size / Math.max(1, wordTokens.length);
    const wit = this.clamp(Math.round(witBase * 6), 0, 5);
    const logic = this.clamp(Math.round(Math.min(5, sentenceCount + connectors)), 0, 5);
    const style = this.clamp(Math.round(Math.min(5, punctuationMarks + (trimmed.length > 120 ? 2 : trimmed.length > 60 ? 1 : 0))), 0, 5);
    const total = wit + logic + style;

    const fallbackFeedback =
      total >= 12
        ? 'Insightful answer—keep pushing deeper.'
        : total >= 7
          ? 'Good effort; clarify your reasoning to strengthen it.'
          : 'Try grounding your answer with clearer ideas.';
    const decision: 'open' | 'ajar' | 'closed' =
      total >= 12 ? 'open' : total >= 7 ? 'ajar' : 'closed';

    let areteEvaluation: AreteEvaluation | null = null;
    try {
      const questionText = riddle.meta?.riddleText ?? 'No riddle question was provided.';
      areteEvaluation = await this.evaluateAnswerWithAI(questionText, trimmed);
    } catch (err) {
      console.error('[Service.submitAnswer] evaluateAnswerWithAI failed', err);
    }
    const finalFeedback = areteEvaluation?.feedback || fallbackFeedback;

    const response: PlayerResponse = {
      id: `resp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      username: playerUsername,
      answerText: trimmed,
      elapsedMs,
      score: { wit, logic, style, total },
      feedback: finalFeedback,
      decision,
      areteEvaluation: areteEvaluation ?? undefined,
    };

    riddle.responses.push(response);
    await this.redis.set(this.riddleKey(riddle.id), JSON.stringify(riddle));

    await this.updateUserXp(playerUsername, total);
    return {
      score: response.score,
      feedback: response.feedback,
      decision,
      responseId: response.id,
      areteEvaluation: areteEvaluation ?? undefined,
    };
  }

  private async resolveSubredditName(explicit?: string): Promise<string> {
    if (explicit) {
      return explicit;
    }

    try {
      const raw = await this.redis.get('debattle:settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.subredditName && typeof parsed.subredditName === 'string') {
          return parsed.subredditName;
        }
      }
    } catch (err) {
      console.warn('[Service.resolveSubredditName] failed to parse cached settings', err);
    }

    try {
      return await this.reddit.getCurrentSubredditName();
    } catch (err) {
      console.error('[Service.resolveSubredditName] fallback to getCurrentSubredditName failed', err);
      throw new Error('Unable to determine subreddit name for sharing');
    }
  }

  private decisionSummary(decision: 'open' | 'ajar' | 'closed'): { label: string; emoji: string } {
    switch (decision) {
      case 'open':
        return { label: 'Door opens to wisdom', emoji: '🟢' };
      case 'ajar':
        return { label: 'Door is ajar', emoji: '🟡' };
      default:
        return { label: 'Door stays closed', emoji: '🔴' };
    }
  }

  async shareResponseToSubreddit(params: {
    riddleId: string;
    responseId: string;
    questionText: string;
    answerText: string;
    playerUsername: string;
    totalScore: number;
    decision: 'open' | 'ajar' | 'closed';
    feedback: string;
    subredditName?: string;
  }): Promise<{ postId: string; permalink?: string }> {
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

    const riddle = await this.getRiddle(riddleId);
    if (!riddle) {
      throw new Error('Riddle not found');
    }

    const response = riddle.responses.find((resp) => resp.id === responseId);
    if (!response) {
      throw new Error('Response not found');
    }

    if (response.postId) {
      try {
        const existing = await this.reddit.getPostById(response.postId);
        return { postId: response.postId, permalink: existing?.permalink };
      } catch (err) {
        console.warn('[Service.shareResponseToSubreddit] response already shared but lookup failed', err);
        return { postId: response.postId };
      }
    }

    const resolvedSubreddit = await this.resolveSubredditName(subredditName);
    const { label, emoji } = this.decisionSummary(decision);
    const title = `${emoji} Debattle · ${totalScore}/15 — ${label}`;
    const sanitizedUsername = playerUsername || 'anonymous';

    // Follow Devvit "share to subreddit" guidance: create a self-post with markdown payload.
    const bodyLines = [
      `**Riddle:** ${questionText}`,
      '',
      `**Answer by u/${sanitizedUsername}:** ${answerText}`,
      '',
      `**Score:** ${totalScore}/15 · **Decision:** ${decision.toUpperCase()}`,
      `**Feedback:** ${feedback}`,
      '',
      '_Shared from the Debattle experience._',
    ];
    const post = await this.reddit.submitPost({
      subredditName: resolvedSubreddit,
      title,
      text: bodyLines.join('\n'),
    });

    response.postId = post.id;
    try {
      await this.redis.set(this.riddleKey(riddle.id), JSON.stringify(riddle));
    } catch (err) {
      console.error('[Service.shareResponseToSubreddit] failed to persist postId', err);
    }

    return { postId: post.id, permalink: post.permalink };
  }

  // Guess Management
  async submitGuess(riddleId: string, username: string, guess: string): Promise<Guess> {
    const riddle = await this.getRiddle(riddleId);
    if (!riddle) throw new Error('Riddle not found');
    
    const newGuess: Guess = {
      id: `guess:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      username,
      guess,
      timestamp: Date.now(),
      upvotes: 0,
      isCorrect: false
    };
    
    const key = `${this.riddleKey(riddleId)}:guesses`;
    const raw = await this.redis.get(key);
    const list: Guess[] = raw ? JSON.parse(raw) : [];
    list.push(newGuess);
    await this.redis.set(key, JSON.stringify(list));
    return newGuess;
  }

  async upvoteGuess(riddleId: string, guessId: string): Promise<void> {
    const key = `${this.riddleKey(riddleId)}:guesses`;
    const raw = await this.redis.get(key);
    if (!raw) return;
    const list: Guess[] = JSON.parse(raw);

    const idx = list.findIndex(g => g.id === guessId);
    if (idx === -1) return;

    list[idx].upvotes++;

    // Award points to guesser (5 points per 10 upvotes)
    const pointsGained = calculateGuessScore(list[idx].upvotes, false);
    await this.updateUserXp(list[idx].username, pointsGained);

    await this.redis.set(key, JSON.stringify(list));
  }

  // Leaderboard Management
  async getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    console.log('[Service.getLeaderboard] start', { limit });
    const users = await this.getAllUsers();
    console.log('[Service.getLeaderboard] users fetched', { count: users.length });
    
    const result = users
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit)
      .map((user, index) => ({
        username: user.username,
        xp: user.xp,
        level: user.level,
        flair: user.flair,
        rank: index + 1
      }));
    console.log('[Service.getLeaderboard] returning', { resultCount: result.length });
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    // hGetAll may return undefined/null on empty; normalize to empty object
    const usersRecord = (await this.redis.hGetAll('users')) ?? ({} as Record<string, string>);
    const keys = Object.keys(usersRecord);
    console.log('[Service.getAllUsers] raw keys', { count: keys.length });
    const users: User[] = [];
    for (const raw of Object.values(usersRecord)) {
      try {
        const u = JSON.parse(raw);
        if (u && typeof u.username === 'string') users.push(u);
      } catch {
        // skip invalid entries
      }
    }
    const normalized = users.map((u) => ({
      ...u,
      level: calculateLevel(u.xp),
      flair: getFlairForLevel(calculateLevel(u.xp)),
    }));
    console.log('[Service.getAllUsers] normalized users', { count: normalized.length });
    return normalized;
  }

  // Utility Methods
  private async updateUserStats(username: string, stat: keyof User, increment: number): Promise<void> {
    const user = await this.getUser(username);
    if (!user) return;
    
    if (typeof user[stat] === 'number') {
      (user as any)[stat] += increment;
      await this.redis.hSet('users', { [username]: JSON.stringify(user) });
    }
  }
  
  async onEvent(event: { comment: { body: string; author: string; id: string }; post: { id: string } }, context: TriggerContext) {
    if (typeof event !== 'object' || !event.comment || !event.post) {
      console.error('Invalid event structure:', event);
      return;
    }
    const { comment, post } = event;
    const body = comment.body.trim();

    // Player submits an answer (expects: !answer <elapsed_ms> | <text>)
    if (body.toLowerCase().startsWith('!answer ')) {
      const payload = body.slice('!answer '.length).trim();
      const pipeIdx = payload.indexOf('|');
      if (pipeIdx > -1) {
        const elapsed = Number(payload.slice(0, pipeIdx).trim());
        const answerText = payload.slice(pipeIdx + 1).trim();
        if (!Number.isNaN(elapsed) && answerText) {
          try {
            const resp = await this.submitAnswer({ riddleId: post.id, playerUsername: comment.author, answerText, elapsed });
            await context.reddit.submitComment({
              id: comment.id,
              text: `🧠 Answer received. Score: **${resp.score.total}/15**. Decision: **${resp.decision}**. Feedback: _${resp.feedback}_`,
            });
          } catch (e) {
            console.error('Error scoring answer:', e);
          }
        }
      }
      return;
    }

    // Legacy: treat !guess as a reflection; award via upvotes only
    if (body.toLowerCase().startsWith('!guess ')) {
      const guess = body.substring(7).trim();
      if (guess) {
        try {
          await this.submitGuess(post.id, comment.author, guess);
          await context.reddit.submitComment({ id: comment.id, text: `📝 Reflection recorded. Earn points via community upvotes.` });
        } catch (error) {
          console.error('Error handling guess:', error);
        }
      }
      return;
    }
  }

  async handleAppUpgrade(event: AppUpgrade, context: TriggerContext): Promise<void> {
    const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubredditName());
    console.log('App upgraded for subreddit:', subredditName ?? '(unknown)');
    
    // Clean up expired riddles
    await this.cleanupExpiredRiddles();
  }

  async syncAnswerPostUpvotes(riddleId: string, responseId: string): Promise<void> {
    const riddle = await this.getRiddle(riddleId);
    if (!riddle) return;
    const resp = riddle.responses.find(r => r.id === responseId);
    if (!resp || !resp.postId) return;

    try {
      const post = await this.reddit.getPostById(resp.postId);
      const bonus = calculatePostBonusFromUpvotes(post.score ?? 0);
      if (bonus > 0) {
        await this.updateUserXp(resp.username, bonus);
      }
    } catch (e) {
      console.error('Failed to sync upvotes:', e);
    }
  }

  private async cleanupExpiredRiddles(): Promise<void> {
    const activeIds = await this.getActiveRiddles();
    if (activeIds.length === 0) return;

    const now = Date.now();
    const remaining: string[] = [];

    for (const rid of activeIds) {
      const riddle = await this.getRiddle(rid);
      if (!riddle) continue;
      if (riddle.expiresAt < now) {
        riddle.status = 'archived';
        await this.redis.set(this.riddleKey(rid), JSON.stringify(riddle));
      } else {
        remaining.push(rid);
      }
    }

    await this.redis.set('riddles:active', JSON.stringify(remaining));
  }

  async getActiveRiddles(): Promise<string[]> {
    const activeRiddles = await this.redis.get('riddles:active');
    if (!activeRiddles) return [];
    
    try {
      return JSON.parse(activeRiddles);
    } catch {
      return [];
    }
  }
}
