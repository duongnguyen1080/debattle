export const MAX_MEANINGFUL_ANSWER_LENGTH = 200;
export const ANSWER_LENGTH_LIMIT_MESSAGE =
  'Answers are limited to 200 characters (spaces and punctuation excluded).';

const createIgnoredCharRegex = (): RegExp => {
  try {
    return new RegExp('[\\s\\p{P}]', 'gu');
  } catch {
    return /[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
  }
};

const IGNORED_ANSWER_CHAR_REGEX = createIgnoredCharRegex();

export const getMeaningfulAnswerLength = (value: string): number => {
  if (!value) {
    return 0;
  }
  return value.replace(IGNORED_ANSWER_CHAR_REGEX, '').length;
};
