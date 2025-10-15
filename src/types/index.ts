// =============================
// Users
// =============================
export interface User {
  username: string;
  xp: number;
  level: number;
  flair: string;
  riddlesCreated: number; // kept for backward compatibility (not used in V2 flow)
  riddlesSolved: number;  // kept for backward compatibility (not used in V2 flow)
  totalUpvotes: number;
  joinDate: number;
  [key: string]: any;
}

// =============================
// Riddle Model (V1 - Legacy)  ⚠️ Deprecated
// Kept to avoid breaking existing imports; do not use for new code.
// =============================
export interface Riddle {
  id: string;
  creator: string;
  theme: string;
  riddleText: string;
  answer: string;
  createdAt: number;
  expiresAt: number;
  isSolved: boolean;
  firstSolver?: string;
  upvotes: number;
  guesses: Guess[];
  [key: string]: any;
}

export interface Guess {
  id: string;
  username: string;
  guess: string;
  timestamp: number;
  upvotes: number;
  isCorrect: boolean; // ignored in V2 flow
  [key: string]: any;
}

// =============================
// Themes
// =============================
export interface Theme {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  [key: string]: any;
}

// Optional UI game state (kept for compatibility; answer is optional now)
export interface GameState {
  currentStep: 'theme' | 'riddle' | 'review' | 'complete';
  selectedTheme?: Theme;
  riddleText: string;
  answer?: string;        // optional: player free-form response
  timeRemaining: number;
  isComplete: boolean;
  [key: string]: any;
}

export interface LeaderboardEntry {
  username: string;
  xp: number;
  level: number;
  flair: string;
  rank: number;
  [key: string]: any;
}

// =============================
// Level Tiers (XP → Levels/Flair)
// =============================
export interface LevelTier {
  level: number;
  minXp: number;
  maxXp: number;
  flair: string;
  notes: string;
  [key: string]: any;
}

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, minXp: 0, maxXp: 49, flair: '🌱 Novice Debattler', notes: 'Entry-level' },
  { level: 2, minXp: 50, maxXp: 199, flair: '✒️ Wordsmith', notes: 'Showing clarity & creativity' },
  { level: 3, minXp: 200, maxXp: 499, flair: '🔍 Riddle Seeker', notes: 'Proven solver' },
  { level: 4, minXp: 500, maxXp: 999, flair: '⚖️ Dialectic Thinker', notes: 'Balanced creator & solver' },
  { level: 5, minXp: 1000, maxXp: 1999, flair: '🔥 Orator', notes: 'High community influence (upvotes)' },
  { level: 6, minXp: 2000, maxXp: 4999, flair: '🧠 Philosopher', notes: 'Recognized thought-leader' },
  { level: 7, minXp: 5000, maxXp: Infinity, flair: '🏛️ Sage of Arete', notes: 'Rare prestige title' },
];

export const THEMES: Theme[] = [
  { id: 'self', name: '🧍 Self', description: 'Riddles about self and identity', difficulty: 2 },
  { id: 'relationships', name: '🤝 Relationships', description: 'Riddles about human connections', difficulty: 2 },
  { id: 'work', name: '💼 Work', description: 'Riddles about labor and purpose', difficulty: 2 },
  { id: 'life', name: '🌅 Life', description: 'Riddles about existence and meaning', difficulty: 3 },
  { id: 'knowledge', name: '📖 Knowledge', description: 'Riddles about wisdom and learning', difficulty: 3 },
];

// =============================
// Riddle Model (V2 - PRD Aligned)
// =============================
export type RiddleStatus = 'active' | 'archived';

export interface PlayerResponse {
  id: string;
  username: string;
  answerText: string;
  elapsedMs: number;      // time-to-answer in ms
  score: {
    wit: number;          // 0–5
    logic: number;        // 0–5
    style: number;        // 0–5
    total: number;        // 0–15 (sum of the above)
  };
  feedback: string;       // AI one-liner
  decision: 'open' | 'ajar' | 'closed';
  postId?: string;        // Reddit post id if posted
  [key: string]: any;
}

export interface AIRiddleMeta {
  theme: string;
  riddleText: string;
  [key: string]: any;
}

export interface RiddleV2 {
  id: string;
  meta: AIRiddleMeta;
  authorUsername: string; // player who triggered/answers this round
  createdAt: number;
  expiresAt: number;      // 24h
  status: RiddleStatus;
  responses: PlayerResponse[];
  postId?: string;        // Reddit post id for the main answer
  [key: string]: any;
}
