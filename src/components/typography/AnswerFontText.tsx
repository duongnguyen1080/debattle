import { Devvit } from '@devvit/public-api';
import { Icons } from '../../icons.js';
import { ANSWER_FONT_GLYPH_WIDTHS } from '../../utils/answerFontGlyphMetrics.js';

const ANSWER_FONT_ASCENDER_HEIGHT = 2000;
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_COLOR = '#2b1e12';
const DEFAULT_LETTER_SPACING = -0.8;
const DEFAULT_LINE_GAP = 18;

const SPACE_CODE_POINTS = new Set<number>([
  0x0009,
  0x000b,
  0x000c,
  0x00a0,
  0x1680,
  0x2000,
  0x2001,
  0x2002,
  0x2003,
  0x2004,
  0x2005,
  0x2006,
  0x2007,
  0x2008,
  0x2009,
  0x200a,
  0x202f,
  0x205f,
  0x3000,
]);

type HorizontalAlign = 'start' | 'center' | 'end';

interface AnswerFontTextProps {
  text: string;
  color?: string;
  fontSize?: number;
  letterSpacing?: number;
  align?: HorizontalAlign;
}

interface WrappedAnswerFontTextProps extends Omit<AnswerFontTextProps, 'text'> {
  text: string;
  maxWidth: number;
  lineGap?: number;
}

interface MeasureAnswerWrappedTextOptions {
  text: string;
  maxWidth: number;
  fontSize?: number;
  letterSpacing?: number;
  lineGap?: number;
}

interface MeasureAnswerWrappedTextResult {
  lines: string[];
  lineCount: number;
  totalHeight: number;
}

type GlyphMeasurement = {
  codePoint: number;
  intrinsicWidth: number;
  renderedWidth: number;
};

const ICON_PREFIX = 'Merriweather_Regular/';
const SVG_DATA_URI_PREFIX = 'data:image/svg+xml;charset=UTF-8,';
const tintedCache = new Map<string, string>();

const OPEN_DOUBLE_QUOTE = '“';
const CLOSE_DOUBLE_QUOTE = '”';
const OPEN_SINGLE_QUOTE = '‘';
const CLOSE_SINGLE_QUOTE = '’';
const ELLIPSIS = '…';
const EM_DASH = '—';

function isLetter(char: string): boolean {
  if (!char) {
    return false;
  }
  const code = char.codePointAt(0) ?? 0;
  if (
    (code >= 48 && code <= 57) || // digits
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  ) {
    return true;
  }
  // Basic Latin supplement and beyond.
  return code >= 0xc0;
}

function smartenText(text: string): string {
  let result = '';
  let doubleOpen = true;
  let singleOpen = true;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      result += doubleOpen ? OPEN_DOUBLE_QUOTE : CLOSE_DOUBLE_QUOTE;
      doubleOpen = !doubleOpen;
      continue;
    }

    if (char === "'") {
      const prev = result[result.length - 1] ?? '';
      const next = text[i + 1] ?? '';
      const prevIsLetter = isLetter(prev);
      const nextIsLetter = isLetter(next);
      if (prevIsLetter && nextIsLetter) {
        result += CLOSE_SINGLE_QUOTE;
        continue;
      }
      if (prevIsLetter && !nextIsLetter) {
        result += CLOSE_SINGLE_QUOTE;
        continue;
      }
      if (!prevIsLetter && nextIsLetter) {
        result += OPEN_SINGLE_QUOTE;
        continue;
      }
      result += singleOpen ? OPEN_SINGLE_QUOTE : CLOSE_SINGLE_QUOTE;
      singleOpen = !singleOpen;
      continue;
    }

    result += char;
  }

  return result
    .replace(/\u00ab/g, OPEN_DOUBLE_QUOTE)
    .replace(/\u00bb/g, CLOSE_DOUBLE_QUOTE)
    .replace(/--/g, EM_DASH)
    .replace(/\.{3}/g, ELLIPSIS);
}

function normalizeText(raw: string): string {
  const collapsed = raw.replace(/\r\n?/g, '\n');
  const chars = Array.from(collapsed);
  const normalized = smartenText(
    chars
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code === 0x200d) {
        return '';
      }
      if (SPACE_CODE_POINTS.has(code)) {
        return ' ';
      }
      return char;
    })
    .join('')
  );
  return normalized;
}

function glyphIntrinsicWidth(codePoint: number): number {
  return ANSWER_FONT_GLYPH_WIDTHS[codePoint] ?? ANSWER_FONT_GLYPH_WIDTHS[32] ?? 476;
}

function measureGlyph(codePoint: number, fontSize: number, letterSpacing: number): GlyphMeasurement {
  const intrinsic = glyphIntrinsicWidth(codePoint);
  const scale = fontSize / ANSWER_FONT_ASCENDER_HEIGHT;
  const isSpace = codePoint === 32;
  const renderedWidth = intrinsic * scale + (isSpace ? 0 : letterSpacing);
  return {
    codePoint,
    intrinsicWidth: intrinsic,
    renderedWidth: Math.max(0, renderedWidth),
  };
}

function horizontalAlignment(align: HorizontalAlign | undefined): Devvit.Blocks.Alignment {
  switch (align) {
    case 'end':
      return 'middle end';
    case 'center':
      return 'middle center';
    case 'start':
    default:
      return 'middle start';
  }
}

function glyphKey(codePoint: number): string {
  return `${ICON_PREFIX}${codePoint}.svg`;
}

function tintedGlyphAsset(codePoint: number, color: string): string | undefined {
  const baseKey = glyphKey(codePoint);
  const iconMap = Icons as Record<string, string>;
  const baseIcon = iconMap[baseKey];
  if (!baseIcon) {
    console.warn('[AnswerFontText] Missing icon key:', baseKey);
    return undefined;
  }

  const cacheKey = `${baseKey}:${color}`;
  const cached = tintedCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let payload = baseIcon;
  if (baseIcon.startsWith('data:image/svg+xml')) {
    const comma = baseIcon.indexOf(',');
    payload = comma >= 0 ? baseIcon.slice(comma + 1) : '';
  }

  let rawSvg = payload;
  if (!/</.test(rawSvg)) {
    try {
      rawSvg = decodeURIComponent(payload);
    } catch {
      rawSvg = payload;
    }
  }

  const tinted = rawSvg.replace(/currentColor/g, color);
  if (!/currentColor/.test(rawSvg) && rawSvg === tinted) {
    console.warn('[AnswerFontText] Tint skipped; no currentColor token in', baseKey);
  }

  if (!/<svg[\s>]/i.test(tinted)) {
    console.warn('[AnswerFontText] Invalid tinted SVG payload for', baseKey);
    tintedCache.set(cacheKey, baseIcon);
    return baseIcon;
  }

  const tintedUri = `${SVG_DATA_URI_PREFIX}${encodeURIComponent(tinted)}`;
  if (tintedUri === SVG_DATA_URI_PREFIX) {
    console.warn('[AnswerFontText] Empty tinted URI for', baseKey);
    tintedCache.set(cacheKey, baseIcon);
    return baseIcon;
  }

  tintedCache.set(cacheKey, tintedUri);
  return tintedUri;
}

function renderGlyph(
  measurement: GlyphMeasurement,
  index: number,
  fontSize: number,
  color: string
): Devvit.Blocks.Component {
  if (measurement.codePoint === 32) {
    return <spacer key={`answer-space-${index}`} width={`${measurement.renderedWidth}px`} />;
  }

  const asset = tintedGlyphAsset(measurement.codePoint, color);
  if (!asset) {
    return <spacer key={`answer-missing-${index}`} width={`${measurement.renderedWidth}px`} />;
  }

  return (
    <image
      key={`answer-glyph-${measurement.codePoint}-${index}`}
      url={asset}
      width={`${measurement.renderedWidth}px`}
      height={`${fontSize}px`}
      imageWidth={measurement.intrinsicWidth}
      imageHeight={ANSWER_FONT_ASCENDER_HEIGHT}
      resizeMode="stretch"
      description={`Merriweather glyph ${String.fromCodePoint(measurement.codePoint)}`}
    />
  );
}

function measureRun(text: string, fontSize: number, letterSpacing: number): number {
  let width = 0;
  for (const char of Array.from(text)) {
    const codePoint = char.codePointAt(0) ?? 32;
    width += measureGlyph(codePoint, fontSize, letterSpacing).renderedWidth;
  }
  return width;
}

function wrapLine(
  line: string,
  maxWidth: number,
  fontSize: number,
  letterSpacing: number
): string[] {
  if (maxWidth <= 0 || !line.length) {
    return [line];
  }

  const tokens = line.match(/\S+|\s+/g) ?? [];
  const committed: string[] = [];
  let current = '';
  let currentWidth = 0;

  const flush = () => {
    committed.push(current.trimEnd());
    current = '';
    currentWidth = 0;
  };

  for (const token of tokens) {
    const tokenWidth = measureRun(token, fontSize, letterSpacing);
    if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
      flush();
      if (token.trim().length === 0) {
        continue;
      }
      if (tokenWidth > maxWidth) {
        // fallback to per-character splitting
        let word = '';
        let wordWidth = 0;
        for (const char of token) {
          const charWidth = measureRun(char, fontSize, letterSpacing);
          if (wordWidth > 0 && wordWidth + charWidth > maxWidth) {
            committed.push(word);
            word = char;
            wordWidth = charWidth;
          } else {
            word += char;
            wordWidth += charWidth;
          }
        }
        current = word;
        currentWidth = wordWidth;
      } else {
        current = token;
        currentWidth = tokenWidth;
      }
      continue;
    }

    current += token;
    currentWidth += tokenWidth;
  }

  if (current.trim().length > 0 || committed.length === 0) {
    committed.push(current.trimEnd());
  }

  return committed;
}

export function measureAnswerWrappedText({
  text,
  maxWidth,
  fontSize = DEFAULT_FONT_SIZE,
  letterSpacing = DEFAULT_LETTER_SPACING,
  lineGap = DEFAULT_LINE_GAP,
}: MeasureAnswerWrappedTextOptions): MeasureAnswerWrappedTextResult {
  const normalized = normalizeText(text);
  const baseLines = normalized.split('\n');
  const wrappedLines = baseLines.flatMap((line) =>
    line.length === 0 ? [''] : wrapLine(line, maxWidth, fontSize, letterSpacing)
  );
  const lineCount = wrappedLines.length;
  const totalHeight =
    lineCount === 0 ? 0 : lineCount * fontSize + Math.max(0, lineCount - 1) * lineGap;
  return {
    lines: wrappedLines,
    lineCount,
    totalHeight,
  };
}

export function AnswerFontText({
  text,
  color = DEFAULT_COLOR,
  fontSize = DEFAULT_FONT_SIZE,
  letterSpacing = DEFAULT_LETTER_SPACING,
  align = 'start',
}: AnswerFontTextProps): Devvit.Blocks.Component {
  const normalized = normalizeText(text);
  const glyphs = Array.from(normalized);
  const measurements = glyphs.map((char) => {
    const codePoint = char.codePointAt(0) ?? 32;
    return measureGlyph(codePoint, fontSize, letterSpacing);
  });
  return (
    <hstack alignment={horizontalAlignment(align)} gap="none">
      {measurements.map((measurement, index) => renderGlyph(measurement, index, fontSize, color))}
    </hstack>
  );
}

export function WrappedAnswerFontText({
  text,
  maxWidth,
  color = DEFAULT_COLOR,
  fontSize = DEFAULT_FONT_SIZE,
  letterSpacing = DEFAULT_LETTER_SPACING,
  lineGap = DEFAULT_LINE_GAP,
  align = 'center',
}: WrappedAnswerFontTextProps): Devvit.Blocks.Component {
  const { lines } = measureAnswerWrappedText({ text, maxWidth, fontSize, letterSpacing, lineGap });
  return (
    <vstack alignment={horizontalAlignment(align)} gap={`${lineGap}px`}>
      {lines.map((line, index) => (
        <AnswerFontText
          key={`answer-line-${index}`}
          text={line}
          color={color}
          fontSize={fontSize}
          letterSpacing={letterSpacing}
          align={align}
        />
      ))}
    </vstack>
  );
}
