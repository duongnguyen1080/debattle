import { User, LevelTier, LEVEL_TIERS, Theme, THEMES } from '../types/index.js';

// =============================
// Leveling & Flair
// =============================
export function calculateLevel(xp: number): number {
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_TIERS[i].minXp) {
      return LEVEL_TIERS[i].level;
    }
  }
  return 1;
}

export function getFlairForLevel(level: number): string {
  const tier = LEVEL_TIERS.find(t => t.level === level);
  return tier ? tier.flair : LEVEL_TIERS[0].flair;
}

export function getNextLevelXp(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  const nextTier = LEVEL_TIERS.find(t => t.level === currentLevel + 1);
  return nextTier ? nextTier.minXp : currentXp;
}

// =============================
// Themes
// =============================
export function getRandomThemes(count: number = 3): Theme[] {
  const shuffled = [...THEMES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// =============================
// Scoring helpers (aligned with PRD)
//  - Time (0–4)
//  - Clarity (0–6)
//  - Originality (0–6)
//  - Aesthetic (0–4)
//  -> Total (0–20)
// =============================
export function timeToScore(elapsedMs: number): number {
  if (elapsedMs <= 30_000) return 4;     // ≤ 30s
  if (elapsedMs <= 60_000) return 3;     // ≤ 60s
  if (elapsedMs <= 90_000) return 2;     // ≤ 90s
  if (elapsedMs <= 120_000) return 1;    // ≤ 120s
  return 0;                              // > 120s
}

export function weightScores(input: { elapsedMs: number; clarity: number; originality: number; aesthetic: number; }) {
  const time = timeToScore(input.elapsedMs); // 0–4 (20%)
  const clarity = Math.max(0, Math.min(6, input.clarity));
  const originality = Math.max(0, Math.min(6, input.originality));
  const aesthetic = Math.max(0, Math.min(4, input.aesthetic));
  const total = time + clarity + originality + aesthetic; // 0–20
  return { time, clarity, originality, aesthetic, total };
}

// Legacy wrapper kept for compatibility (now maps to the 0–20 rubric)
export function calculateRiddleScore(
  speedSeconds: number,
  clarity: number,
  originality: number,
  aesthetic: number
): number {
  const { total } = weightScores({
    elapsedMs: Math.max(0, Math.round(speedSeconds * 1000)),
    clarity,
    originality,
    aesthetic,
  });
  return total;
}

// =============================
// Community bonuses
// =============================
// Comment/guess upvotes → points (keep signature for compatibility)
export function calculateGuessScore(upvotes: number, _isFirstSolver: boolean): number {
  // In the AI-quality model there is no binary “first solver” bonus.
  // Points accrue from community upvotes only: +5 per 10 upvotes.
  const fromUpvotes = Math.floor((upvotes || 0) / 10) * 5;
  return fromUpvotes;
}

// Post upvotes bonus for the answer owner (+5 per 10 upvotes)
export function calculatePostBonusFromUpvotes(upvotes: number): number {
  if (!upvotes || upvotes <= 0) return 0;
  return Math.floor(upvotes / 10) * 5;
}

// =============================
// Time formatting & expiry
// =============================
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function isRiddleExpired(createdAt: number, lifespanHours: number = 24): boolean {
  const now = Date.now();
  const expirationTime = createdAt + (lifespanHours * 60 * 60 * 1000);
  return now > expirationTime;
}

export function getTimeRemaining(createdAt: number, lifespanHours: number = 24): number {
  const now = Date.now();
  const expirationTime = createdAt + (lifespanHours * 60 * 60 * 1000);
  return Math.max(0, Math.floor((expirationTime - now) / 1000));
}

// =============================
// Validation (riddle text only; no canonical answer in PRD)
// Keep the old signature for compatibility but ignore `answer`.
// =============================
export function validateRiddle(riddleText: string, _answer?: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!riddleText || riddleText.trim().length < 10) {
    errors.push('Riddle must be at least 10 characters long');
  }
  return { isValid: errors.length === 0, errors };
}
