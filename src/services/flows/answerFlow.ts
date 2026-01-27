import type { User, AreteEvaluation, PlayerResponse } from '../../types/index.js';
import type { RiddleFlow } from './riddleFlow.js';

const ARETE_SYSTEM_PROMPT = `You are the Guardian of the Arete Gate, keeper of wisdom and judge of truth.
Your task is to evaluate the wanderer\u2019s answer to decide if the gate shall open \u2014 and how many points they deserve.

Read the question and the answer carefully.
Then evaluate based on the five criteria below.

1. Relevance (Yes / No \u2014 STRICT)
Does the answer clearly respond to the idea or subject of the question?
Does it share a logical or thematic connection to the question?
Would a reasonable reader say, "Yes, this directly answers that question"?
If the answer merely sounds philosophical but does not logically or semantically relate to the question, mark "No."
If the answer reuses memorized or generic moral statements without touching the question\u2019s topic, mark "No."
When judging Relevance, compare meanings directly. If the answer does not clearly engage with the question\u2019s idea, score No even if it sounds deep or poetic.
Profound tone \u2260 relevance; logical connection is required.
If Yes \u2192 award 50 points and continue to the next criteria.
If No \u2192 award 0 points and return only this feedback: "Stay Concise".

2. Completeness (1\u201310)
How fully does the answer explore and satisfy the question?
1\u20132: Extremely incomplete or fragmentary; gives no real reasoning or insight.
3\u20134: Touches part of the question but leaves most unaddressed; lacks development.
5\u20136: Addresses the main idea but misses depth or supporting reasoning.
7\u20138: Covers most aspects clearly, with good supporting thought; minor gaps.
9\u201310: Thorough, well-reasoned, and leaves the reader feeling fully satisfied.

3. Clarity (1\u201310)
How easy is it to understand?
1\u20132: Disorganized, confusing, or grammatically broken.
3\u20134: Roughly understandable but with unclear logic or phrasing.
5\u20136: Generally clear but has awkward structure or minor confusion.
7\u20138: Smooth, logically structured, easy to follow.
9\u201310: Exceptionally clear, elegant, and effortless to read.

4. Originality (1\u201310)
How unique or authentic is the thought?
1\u20132: Clich\u00e9, copied, or entirely generic.
3\u20134: Predictable or derivative; minimal personal thinking.
5\u20136: Some individuality, but familiar reasoning.
7\u20138: Fresh and personal perspective with clear insight.
9\u201310: Deeply original; feels like a new way of seeing the question.

5. Aesthetic (1\u201310)
How beautifully or expressively is it written?
1\u20132: Flat or clumsy language; no emotional tone.
3\u20134: Simple phrasing; functional but dull.
5\u20136: Some rhythm or imagery but uneven expression.
7\u20138: Graceful style; pleasing flow or subtle emotion.
9\u201310: Lyrical, poetic, or literary; evokes beauty or depth of feeling.

Scoring & Feedback
Max score: 90 points (50 + 10 + 10 + 10 + 10).
If Relevance = No \u2192 return only feedback "Stay Concise" and set totalPoints to 0.
Otherwise, return the sum of all points and a short praise based on which criterion (2\u20135) has the highest score (tie-break priority: Completeness > Clarity > Originality > Aesthetic):
Completeness \u2192 "Impeccably detailed!"
Clarity \u2192 "Perfectly lucid!"
Originality \u2192 "Brilliantly unique!"
Aesthetic \u2192 "Beautiful expression!"

Output Requirements
- Always respond with minified JSON only (no markdown or prose).
- When relevance is "Yes", include the keys relevance, completeness, clarity, originality, aesthetic, totalPoints, and feedback.
- When relevance is "No", respond exactly with {"relevance":"No","totalPoints":0,"feedback":"Stay Concise"}.`;

export interface SubmitAnswerParams {
  riddleId: string;
  playerUsername: string;
  answerText: string;
  elapsed: number;
}

export interface SubmitAnswerResult {
  score: { wit: number; logic: number; style: number; total: number };
  feedback: string;
  decision: 'open' | 'ajar' | 'closed';
  responseId: string;
  areteEvaluation?: AreteEvaluation;
}

export interface AnswerFlow {
  submitAnswer(params: SubmitAnswerParams): Promise<SubmitAnswerResult>;
}

export function createAnswerFlow(deps: {
  riddleFlow: RiddleFlow;
  updateUserXp: (username: string, xpGained: number) => Promise<User>;
  getSetting?: (key: string) => Promise<string | null | undefined>;
}): AnswerFlow {
  const { riddleFlow, updateUserXp, getSetting } = deps;

  const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

  const extractJSON = (s: string): any => {
    // Try to parse plain JSON or ```json fenced blocks
    const fence = /```json\s*([\s\S]*?)```/i;
    const m = fence.exec(s);
    const raw = m ? m[1] : s;
    return JSON.parse(raw);
  };

  const openaiModel = (): string => {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  };

  const callOpenAI = async (
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    systemPrompt: string = '',
    timeoutMs: number = 20000
  ): Promise<string> => {
    const apiKey =
      process.env.OPENAI_API_KEY ||
      (getSetting ? await getSetting('OPENAI_API_KEY') : undefined) ||
      (getSetting ? await getSetting('openaiApiKey') : undefined) ||
      '';
    const model =
      process.env.OPENAI_MODEL ||
      (getSetting ? await getSetting('OPENAI_MODEL') : undefined) ||
      (getSetting ? await getSetting('openaiModel') : undefined) ||
      openaiModel();

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
  };

  const evaluateAnswerWithAI = async (questionText: string, answerText: string): Promise<AreteEvaluation> => {
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
      const raw = await callOpenAI(evaluationMessages, system, 20000);

      const obj = extractJSON(raw);
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
        return Math.round(clamp(num, 0, 10));
      };

      const completeness = clampScore(obj.completeness);
      const clarity = clampScore(obj.clarity);
      const originality = clampScore(obj.originality);
      const aesthetic = clampScore(obj.aesthetic);
      const totalPoints = Math.round(clamp(completeness + clarity + originality + aesthetic, 0, 40));
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
  };

  const getSupabaseConfig = async (): Promise<{ url: string; serviceKey: string } | null> => {
    const url =
      process.env.SUPABASE_URL ||
      (getSetting ? await getSetting('supabaseUrl') : undefined) ||
      (getSetting ? await getSetting('SUPABASE_URL') : undefined) ||
      '';
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      (getSetting ? await getSetting('supabaseServiceRoleKey') : undefined) ||
      (getSetting ? await getSetting('SUPABASE_SERVICE_ROLE_KEY') : undefined) ||
      '';

    const normalizedUrl = String(url || '').trim().replace(/\/+$/, '');
    const normalizedKey = String(serviceKey || '').trim();
    if (!normalizedUrl || !normalizedKey) return null;
    return { url: normalizedUrl, serviceKey: normalizedKey };
  };

  const logAnswerToSupabase = async (payload: {
    user_name: string;
    riddle_id: string;
    question_id: string | null;
    question_text: string;
    answer_text: string;
  }): Promise<void> => {
    const config = await getSupabaseConfig();
    if (!config) {
      console.warn('[Service.logAnswerToSupabase] missing supabase config');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${config.url}/rest/v1/answer_events`, {
        method: 'POST',
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        let body = '';
        try {
          body = await res.text();
        } catch {
          // ignore
        }
        console.warn('[Service.logAnswerToSupabase] insert failed', {
          status: res.status,
          statusText: res.statusText,
          body,
        });
      }
    } catch (err) {
      console.warn('[Service.logAnswerToSupabase] insert error', err);
    } finally {
      clearTimeout(timeout);
    }
  };

  const decisionFromArete = (arete?: AreteEvaluation | null): ('open' | 'ajar' | 'closed') | null => {
    if (!arete) {
      return null;
    }
    const totalPoints = typeof arete.totalPoints === 'number' ? arete.totalPoints : 0;
    if (arete.relevance !== 'Yes' || totalPoints <= 0) {
      return 'closed';
    }
    if (totalPoints <= 55) {
      return 'ajar';
    }
    return 'open';
  };

  const submitAnswer = async (params: SubmitAnswerParams): Promise<SubmitAnswerResult> => {
    const { riddleId, playerUsername, answerText, elapsed } = params;
    const riddle = await riddleFlow.getRiddle(riddleId);
    if (!riddle || riddle.status !== 'active') {
      throw new Error('Riddle not found or inactive');
    }

    const trimmed = answerText.trim();
    const elapsedMs = clamp(Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0, 0, 10 * 60 * 1000);
    const wordTokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const uniqueWords = new Set(trimmed.toLowerCase().match(/\b[a-z']+\b/g) ?? []);
    const connectors = (trimmed.match(/\b(because|therefore|thus|hence|so|consequently)\b/gi) ?? []).length;
    const punctuationMarks = (trimmed.match(/[,:;\u2014\u2013-]/g) ?? []).length;
    const sentenceCount = (trimmed.match(/[.!?]+/g) ?? []).length || (trimmed ? 1 : 0);

    const witBase = uniqueWords.size / Math.max(1, wordTokens.length);
    const wit = clamp(Math.round(witBase * 6), 0, 5);
    const logic = clamp(Math.round(Math.min(5, sentenceCount + connectors)), 0, 5);
    const style = clamp(Math.round(Math.min(5, punctuationMarks + (trimmed.length > 120 ? 2 : trimmed.length > 60 ? 1 : 0))), 0, 5);
    const total = wit + logic + style;

    const fallbackFeedback =
      total >= 12
        ? 'Insightful answer\u2014keep pushing deeper.'
        : total >= 7
          ? 'Good effort; clarify your reasoning to strengthen it.'
          : 'Try grounding your answer with clearer ideas.';
    const fallbackDecision: 'open' | 'ajar' | 'closed' =
      total >= 12 ? 'open' : total >= 7 ? 'ajar' : 'closed';

    const questionText = riddle.meta?.riddleText ?? 'No riddle question was provided.';
    const questionId = typeof riddle.meta?.questionId === 'string' ? riddle.meta.questionId : null;

    let areteEvaluation: AreteEvaluation | null = null;
    try {
      areteEvaluation = await evaluateAnswerWithAI(questionText, trimmed);
    } catch (err) {
      console.error('[Service.submitAnswer] evaluateAnswerWithAI failed', err);
    }
    const areteDecision = decisionFromArete(areteEvaluation ?? undefined);
    const decision: 'open' | 'ajar' | 'closed' = areteDecision ?? fallbackDecision;
    const finalFeedback = areteEvaluation?.feedback ?? fallbackFeedback;

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
    await riddleFlow.saveRiddle(riddle);

    await updateUserXp(playerUsername, total);
    await logAnswerToSupabase({
      user_name: playerUsername,
      riddle_id: riddle.id,
      question_id: questionId,
      question_text: questionText,
      answer_text: trimmed,
    });
    return {
      score: response.score,
      feedback: response.feedback,
      decision,
      responseId: response.id,
      areteEvaluation: areteEvaluation ?? undefined,
    };
  };

  return { submitAnswer };
}
