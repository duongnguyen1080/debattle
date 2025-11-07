export type Step = 'answer' | 'result';

export type RoundResult = {
  score: { wit: number; logic: number; style: number; total: number };
  feedback: string;
  decision: 'open' | 'ajar' | 'closed';
  questionText: string;
  answerText: string;
  responseId: string;
  sharePostId?: string;
  sharePermalink?: string;
};

export const FALLBACK_RIDDLE_TEXT = 'What do you owe to yourself that cannot be owned?';
