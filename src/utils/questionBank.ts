import questionsRaw from '../data/debattle_questions.json';

export interface QuestionBankEntry {
  id: number;
  theme: string;
  question: string;
}

type RawQuestion = Partial<QuestionBankEntry>;

const QUESTIONS: QuestionBankEntry[] = (Array.isArray(questionsRaw) ? questionsRaw : [])
  .filter((entry: RawQuestion): entry is QuestionBankEntry => {
    return (
      typeof entry?.id === 'number' &&
      typeof entry?.theme === 'string' &&
      typeof entry?.question === 'string'
    );
  })
  .map((entry) => ({
    id: entry.id,
    theme: entry.theme.trim(),
    question: entry.question.trim(),
  }));

if (QUESTIONS.length === 0) {
  console.warn('[questionBank] Loaded question list is empty');
}

/**
 * Returns a uniformly random question from the curated bank.
 * Accepts an optional RNG for deterministic testing.
 */
export function getRandomQuestion(random: () => number = Math.random): QuestionBankEntry {
  if (QUESTIONS.length === 0) {
    throw new Error('Question bank is empty');
  }
  const index = Math.floor(random() * QUESTIONS.length);
  return QUESTIONS[index];
}

export function getQuestionCount(): number {
  return QUESTIONS.length;
}

export function getAllQuestions(): readonly QuestionBankEntry[] {
  return QUESTIONS;
}
