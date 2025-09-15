import { RedisClient, RedditAPIClient, AppUpgrade, TriggerContext } from '@devvit/public-api';
import { User, Guess, Theme, LeaderboardEntry } from '../types/index.js';
import { RiddleV2, PlayerResponse } from '../types/index.js';
import { calculateLevel, getFlairForLevel, calculateRiddleScore, calculateGuessScore } from '../utils/gameUtils.js';
import { weightScores, calculatePostBonusFromUpvotes } from '../utils/gameUtils.js';

export class Service {
  constructor(
    private redis: RedisClient,
    private reddit: RedditAPIClient
  ) {}

  // --- AI integration (Anthropic only) ---
  // Provider is fixed to 'anthropic' for this deployment.
  // Key via env: ANTHROPIC_API_KEY
  private get aiProvider(): 'openai' | 'anthropic' {
    return 'anthropic';
  }

  private get anthropicModel(): string {
    // pick a strong default; you can override via ANTHROPIC_MODEL
    return process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
  }

  private clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)); }

  private extractJSON(s: string): any {
    // Try to parse plain JSON or ```json fenced blocks
    const fence = /```json\s*([\s\S]*?)```/i;
    const m = fence.exec(s);
    const raw = m ? m[1] : s;
    return JSON.parse(raw);
  }


  private async callAnthropic(messages: { role: 'system'|'user'|'assistant'; content: string }[],
                              systemPrompt: string = '',
                              timeoutMs: number = 20000): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.anthropicModel,
          system: systemPrompt,
          max_tokens: 512,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const content = data.content?.[0]?.text ?? '';
      return String(content);
    } finally { clearTimeout(to); }
  }

  // Generate a philosophical riddle from theme
  async generateRiddleFromAI(theme: string): Promise<{ riddleText: string }> {
    console.log('[Service.generateRiddleFromAI] start', { theme });
    const system = `You are an AI riddle-smith. Write a SINGLE short philosophical riddle aligned to a given theme.
Rules:\n- 1–3 sentences max.\n- Do NOT include the answer.\n- No leading labels like 'Riddle:'.\n- Avoid clichés.\n- The riddle must clearly relate to the provided theme.\nOutput strictly as JSON: {"riddleText": "..."}`;

    const user = `Theme: ${theme}`;

    try {
      const raw = await this.callAnthropic(
        [{ role: 'user', content: user }],
        system,
        20000
      );

      // Parse JSON
      const obj = this.extractJSON(raw);
      if (!obj || typeof obj.riddleText !== 'string') throw new Error('Invalid riddle JSON');
      const riddleText = obj.riddleText.trim();
      if (riddleText.length < 10) throw new Error('Riddle too short');
      console.log('[Service.generateRiddleFromAI] success');
      return { riddleText };
    } catch (err) {
      console.error('[Service.generateRiddleFromAI] failed; using fallback', err);
      // graceful fallback to keep the game running
      return { riddleText: `On the theme of ${theme}: What do you owe to yourself that cannot be owned?` };
    }
  }

  // Evaluate an answer using rubric → return clarity/originality/aesthetic + feedback
  async evaluateAnswerWithAI(answerText: string): Promise<{ clarity: number; originality: number; aesthetic: number; feedback: string; }> {
    const system = `You are a strict grader following a fixed rubric. Score ONLY the user's answer text.
Rubric (numerical):\n- clarity: 0–6 (precision, coherence)\n- originality: 0–6 (novelty, insight)\n- aesthetic: 0–4 (style, elegance)\nReturn JSON only: {"clarity":0-6, "originality":0-6, "aesthetic":0-4, "feedback":"one short sentence"}.`;

    const user = `Answer to evaluate:\n${answerText}`;

    try {
      const raw = await this.callAnthropic(
        [{ role: 'user', content: user }],
        system,
        20000
      );

      const obj = this.extractJSON(raw);
      let clarity = this.clamp(Number(obj.clarity), 0, 6);
      let originality = this.clamp(Number(obj.originality), 0, 6);
      let aesthetic = this.clamp(Number(obj.aesthetic), 0, 4);
      let feedback = String(obj.feedback || '').trim();
      if (!feedback) feedback = 'Thoughtful, but push for sharper focus.';
      return { clarity, originality, aesthetic, feedback };
    } catch (err) {
      console.error('evaluateAnswerWithAI failed:', err);
      // graceful fallback mid-range
      return { clarity: 4, originality: 4, aesthetic: 2, feedback: 'Thoughtful, but push for sharper focus.' };
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
  async createRiddleFromTheme(params: { theme: string; playerUsername: string }): Promise<RiddleV2> {
    const { theme, playerUsername } = params;
    console.log('[Service.createRiddleFromTheme] start', { theme, playerUsername });
    const id = `riddle:${Date.now()}:${Math.random().toString(36).slice(2, 11)}`;
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24h

    const ai = await this.generateRiddleFromAI(theme);

    const riddle: RiddleV2 = {
      id,
      meta: { theme, riddleText: ai.riddleText },
      authorUsername: playerUsername,
      createdAt: now,
      expiresAt,
      status: 'active',
      responses: [],
    };

    console.log('[Service.createRiddleFromTheme] persisting');
    try {
      await this.redis.set(`riddle:${id}`, JSON.stringify(riddle));
      console.log('[Service.createRiddleFromTheme] stored riddle blob');
    } catch (e) {
      console.error('[Service.createRiddleFromTheme] failed to store riddle', e);
    }
    try {
      const active = await this.getActiveRiddles();
      const next = Array.isArray(active) ? [...active, id] : [id];
      await this.redis.set('riddles:active', JSON.stringify(next));
      console.log('[Service.createRiddleFromTheme] updated active list', { count: next.length });
    } catch (e) {
      console.error('[Service.createRiddleFromTheme] failed to update active list', e);
    }
    console.log('[Service.createRiddleFromTheme] done', { id });
    return riddle;
  }

  async getRiddle(id: string): Promise<RiddleV2 | null> {
    const raw = await this.redis.get(`riddle:${id}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as RiddleV2; } catch { return null; }
  }

  async submitAnswer(params: { riddleId: string; username: string; answerText: string; elapsedMs: number }): Promise<PlayerResponse> {
    const { riddleId, username, answerText, elapsedMs } = params;
    const riddle = await this.getRiddle(riddleId);
    if (!riddle || riddle.status !== 'active') throw new Error('Riddle not found or inactive');

    const ai = await this.evaluateAnswerWithAI(answerText);
    const scored = weightScores({ elapsedMs, clarity: ai.clarity, originality: ai.originality, aesthetic: ai.aesthetic });

    const response: PlayerResponse = {
      id: `resp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      username,
      answerText,
      elapsedMs,
      scores: { time: scored.time, clarity: scored.clarity, originality: scored.originality, aesthetic: scored.aesthetic },
      total: scored.total,
      feedback: ai.feedback,
    };

    riddle.responses.push(response);
    await this.redis.set(`riddle:${riddle.id}`, JSON.stringify(riddle));

    // XP = total points
    await this.updateUserXp(username, response.total);
    return response;
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
    
    const key = `riddle:${riddleId}:guesses`;
    const raw = await this.redis.get(key);
    const list: Guess[] = raw ? JSON.parse(raw) : [];
    list.push(newGuess);
    await this.redis.set(key, JSON.stringify(list));
    return newGuess;
  }

  async upvoteGuess(riddleId: string, guessId: string): Promise<void> {
    const key = `riddle:${riddleId}:guesses`;
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
            const resp = await this.submitAnswer({ riddleId: post.id, username: comment.author, answerText, elapsedMs: elapsed });
            await context.reddit.submitComment({ id: comment.id, text: `🧠 Answer received. Score: **${resp.total}/20**. Feedback: _${resp.feedback}_` });
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
        await this.redis.set(`riddle:${rid}`, JSON.stringify(riddle));
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
