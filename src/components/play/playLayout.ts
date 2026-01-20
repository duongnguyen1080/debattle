import type { AreteEvaluation } from '../../types/index.js';
import { measureWrappedText } from '../typography/FontText.js';

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
  areteEvaluation?: AreteEvaluation;
};

export const FALLBACK_RIDDLE_TEXT = 'What do you owe to yourself that cannot be owned?';

export const CTA_BUTTON_WIDTH_PX = 203;
export const CTA_BUTTON_HEIGHT_PX = 106;
export const CTA_BOTTOM_INSET_PX = 56;
export const NAV_ICON_SIZE_PX = 55;

export type RiddleLayoutStyle = {
  color: string;
  fontSize: number;
  lineGap: number;
  letterSpacing: number;
  targetLinesMin: number;
  targetLinesMax: number;
};

export const RIDDLE_STYLE: RiddleLayoutStyle = {
  color: '#231414',
  fontSize: 40,
  lineGap: 10,
  letterSpacing: -2,
  targetLinesMin: 2,
  targetLinesMax: 5,
};
export type RiddleLayoutStyleOverrides = Partial<
  Pick<RiddleLayoutStyle, 'fontSize' | 'letterSpacing' | 'lineGap' | 'targetLinesMin' | 'targetLinesMax'>
>;

type ParchmentConfig = {
  minWidth: number;
  maxWidth: number;
  capTop: number;
  capBottom: number;
  midTile: number;
  padX: number;
  padY: number;
  minHeight: number;
  maxHeight: number;
};

export const PARCHMENT: ParchmentConfig = {
  minWidth: 560,
  maxWidth: 860,
  capTop: 72,
  capBottom: 72,
  midTile: 48,
  padX: 40,
  padY: 20,
  minHeight: 140,
  maxHeight: 300,
};

type ViewConfig = {
  minWidth: number;
  maxWidth: number;
};

export const VIEW: ViewConfig = {
  minWidth: 520,
  maxWidth: 900,
};

type LayoutConfig = {
  maxParchmentFraction: number;
  buttonGapFraction: number;
};

export const LAYOUT: LayoutConfig = {
  maxParchmentFraction: 0.43,
  buttonGapFraction: 0.02,
};

export const SLICE_PIXEL_DIMENSIONS = {
  top: { width: 816, height: 74 },
  mid: { width: 816, height: 104 },
  bottom: { width: 811, height: 64 },
} as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

export function chooseResponsiveWidth(
  text: string,
  style: RiddleLayoutStyle = RIDDLE_STYLE
): number {
  const { minWidth, maxWidth, padX } = PARCHMENT;
  const { fontSize, letterSpacing, lineGap, targetLinesMin, targetLinesMax } = style;

  if (maxWidth <= minWidth) {
    return clamp(minWidth, VIEW.minWidth, VIEW.maxWidth);
  }

  const candidates: number[] = [];
  for (let width = minWidth; width <= maxWidth; width += 40) {
    candidates.push(width);
  }
  if (candidates[candidates.length - 1] !== maxWidth) {
    candidates.push(maxWidth);
  }

  let bestWidth = maxWidth;
  let bestDiff = Number.POSITIVE_INFINITY;
  let sawAbove = false;
  let sawBelow = false;

  for (const width of candidates) {
    const contentWidth = Math.max(1, width - padX * 2);
    const { lineCount } = measureWrappedText({
      text,
      maxWidth: contentWidth,
      fontSize,
      letterSpacing,
      lineGap,
    });

    if (lineCount >= targetLinesMin && lineCount <= targetLinesMax) {
      return clamp(width, VIEW.minWidth, VIEW.maxWidth);
    }

    if (lineCount > targetLinesMax) {
      sawAbove = true;
      const diff = lineCount - targetLinesMax;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestWidth = width;
      }
    } else if (lineCount < targetLinesMin) {
      sawBelow = true;
      const diff = targetLinesMin - lineCount;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestWidth = width;
      }
    }
  }

  if (sawAbove && !sawBelow) {
    return clamp(PARCHMENT.maxWidth, VIEW.minWidth, VIEW.maxWidth);
  }
  if (sawBelow && !sawAbove) {
    return clamp(PARCHMENT.minWidth, VIEW.minWidth, VIEW.maxWidth);
  }

  return clamp(bestWidth, VIEW.minWidth, VIEW.maxWidth);
}

export function computeParchmentLayout(
  text: string,
  styleOverrides?: RiddleLayoutStyleOverrides
) {
  const textStyle: RiddleLayoutStyle = { ...RIDDLE_STYLE, ...styleOverrides };
  const width = chooseResponsiveWidth(text, textStyle);
  const { capTop, capBottom, midTile, padX, padY, minHeight, maxHeight } = PARCHMENT;
  const { fontSize, letterSpacing, lineGap } = textStyle;

  const contentWidth = Math.max(1, width - padX * 2);

  const { totalHeight } = measureWrappedText({
    text,
    maxWidth: contentWidth,
    fontSize,
    letterSpacing,
    lineGap,
  });

  const neededInner = totalHeight + padY * 2;
  const minInner = Math.max(minHeight, capTop + capBottom);
  const maxInner = Math.max(minInner, maxHeight);
  const clampedInner = clamp(neededInner, minInner, maxInner);
  const middleBand = Math.max(0, clampedInner - capTop - capBottom);
  const tiles = middleBand > 0 ? Math.ceil(middleBand / midTile) : 0;
  const flyerHeight = capTop + tiles * midTile + capBottom;
  const extraPadY = Math.max(0, (flyerHeight - neededInner) / 2);
  const needsScroll = neededInner > flyerHeight;

  return {
    width,
    contentWidth,
    innerHeight: flyerHeight,
    flyerHeight,
    tiles,
    extraPadY,
    needsScroll,
  };
}
