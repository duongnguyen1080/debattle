import { Devvit } from '@devvit/public-api';
import { Icons } from '../../icons.js';
import { PIRATA_ONE_GLYPH_WIDTHS } from '../../utils/pirataGlyphMetrics.js';

const PIRATA_ONE_ASCENDER_HEIGHT = 1000;
const DEFAULT_FONT_SIZE = 78;
const DEFAULT_COLOR = '#2d1b0c';
// const DEFAULT_LETTER_SPACING = -4;
const DEFAULT_LETTER_SPACING = -2;
const DEFAULT_LINE_GAP = 12;
// const MIN_GLYPH_WIDTH_FACTOR = 0.12;
const MIN_GLYPH_WIDTH_FACTOR = 0; // or try 0.02–0.04 if you really want a tiny floor

const SPACE_CODE_POINTS = new Set<number>([
  0x0009, // tab
  0x000b,
  0x000c,
  0x00a0, // nbsp
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

interface FontTextProps {
  text: string;
  color?: string;
  fontSize?: number;
  letterSpacing?: number;
  align?: HorizontalAlign;
}

interface WrappedFontTextProps extends Omit<FontTextProps, 'text'> {
  text: string;
  maxWidth: number;
  lineGap?: number;
}

interface MeasureWrappedTextOptions {
  text: string;
  maxWidth: number;
  fontSize?: number;
  letterSpacing?: number;
  lineGap?: number;
}

interface MeasureWrappedTextResult {
  lines: string[];
  lineCount: number;
  totalHeight: number;
}

type GlyphMeasurement = {
  codePoint: number;
  intrinsicWidth: number;
  renderedWidth: number;
};

const ICON_PREFIX = 'Pirata_One/';
const SVG_DATA_URI_PREFIX = 'data:image/svg+xml,';
const tintedCache = new Map<string, string>();
let hasLoggedIconSample = false;

function normalizeText(raw: string): string {
  const collapsed = raw.replace(/\r\n?/g, '\n');
  const chars = Array.from(collapsed);
  const normalized = chars.map((char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x200d) {
      // zero-width joiner – skip it to avoid invisible glyph slots.
      return '';
    }
    if (SPACE_CODE_POINTS.has(code)) {
      return ' ';
    }
    return char;
  });
  return normalized.join('');
}

function glyphIntrinsicWidth(codePoint: number): number {
  return PIRATA_ONE_GLYPH_WIDTHS[codePoint] ?? PIRATA_ONE_GLYPH_WIDTHS[32] ?? 400;
}

function measureGlyph(codePoint: number, fontSize: number, letterSpacing: number): GlyphMeasurement {
  const intrinsicWidth = glyphIntrinsicWidth(codePoint);
  const scale = fontSize / PIRATA_ONE_ASCENDER_HEIGHT;
  const isSpace = codePoint === 32;
  const baselineWidth = intrinsicWidth * scale + (isSpace ? 0 : letterSpacing);
  // Before: clamp to 12% of font size
  // const minimumWidth = isSpace ? 0 : fontSize * MIN_GLYPH_WIDTH_FACTOR;
  // After: only prevent negative widths; opt back in by raising MIN_GLYPH_WIDTH_FACTOR
  const minimumWidth = isSpace ? 0 : Math.max(0, fontSize * MIN_GLYPH_WIDTH_FACTOR);
  const renderedWidth = Math.max(minimumWidth, baselineWidth);
  return { codePoint, intrinsicWidth, renderedWidth };
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

function verticalStackAlignment(align: HorizontalAlign | undefined): Devvit.Blocks.Alignment {
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
    return undefined;
  }
  if (!hasLoggedIconSample) {
    hasLoggedIconSample = true;
    const sampleKeys = Object.keys(Icons).slice(0, 5);
    console.log('[FontText] sample glyph keys', sampleKeys);
    if (sampleKeys.length > 0) {
      console.log('[FontText] sample glyph data', iconMap[sampleKeys[0]]);
    }
  }

  const cacheKey = `${baseKey}:${color}`;
  const cached = tintedCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let payload = baseIcon;
  if (baseIcon.startsWith('data:image/svg+xml')) {
    const commaIndex = baseIcon.indexOf(',');
    payload = commaIndex >= 0 ? baseIcon.slice(commaIndex + 1) : '';
  }

  let rawSvg = payload;
  if (!/</.test(rawSvg)) {
    try {
      rawSvg = decodeURIComponent(payload);
    } catch {
      rawSvg = payload;
    }
  }

  const cleanedBase = rawSvg
    .replace(/^\s*<\?xml[^>]*>\s*/i, '')
    .replace(/^\s*<!DOCTYPE[^>]*>\s*/i, '')
    .trimStart();

  let normalizedSvg = cleanedBase;
  if (!normalizedSvg.startsWith('<svg')) {
    normalizedSvg = `<svg xmlns="http://www.w3.org/2000/svg">${normalizedSvg}</svg>`;
  } else if (!/xmlns=/.test(normalizedSvg)) {
    normalizedSvg = normalizedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  normalizedSvg = normalizedSvg.replace(
    /<svg\b([^>]*)>/,
    (_m, attrs) =>
      `<svg${attrs} shape-rendering="geometricPrecision" vector-effect="non-scaling-stroke">`
  );

  const tinted = normalizedSvg.replace(/currentColor/g, color);
  const tintedUri = `${SVG_DATA_URI_PREFIX}${encodeURIComponent(tinted)}`;
  tintedCache.set(cacheKey, tintedUri);
  return tintedUri;
}

function renderGlyph(
  measurement: GlyphMeasurement,
  index: number,
  fontSize: number,
  color: string
): JSX.Element {
  const { codePoint, intrinsicWidth, renderedWidth } = measurement;
  if (codePoint === 32) {
    return <spacer key={`space-${index}`} width={`${renderedWidth}px`} />;
  }

  const asset = tintedGlyphAsset(codePoint, color);
  if (!asset) {
    const character = String.fromCodePoint(codePoint);
    return (
      <vstack
        key={`missing-${index}`}
        width={`${Math.max(renderedWidth, fontSize * 0.4)}px`}
        height={`${fontSize}px`}
        alignment="middle center"
        backgroundColor="rgba(0,0,0,0.2)"
      >
        <text size="xsmall" color="#ff5555">
          {character}
        </text>
      </vstack>
    );
  }

  return (
    <image
      key={`${codePoint}-${index}`}
      url={asset}
      width={`${renderedWidth}px`}
      height={`${fontSize}px`}
      imageWidth={intrinsicWidth}
      imageHeight={PIRATA_ONE_ASCENDER_HEIGHT}
      resizeMode="fit"
      description={`Glyph ${String.fromCodePoint(codePoint)}`}
    />
  );
}

function tokenize(line: string): string[] {
  const tokens = line.match(/\S+|\s+/g);
  return tokens ?? [];
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
  if (maxWidth <= 0) {
    return [line];
  }

  const committed: string[] = [];
  let current = '';
  let currentWidth = 0;

  const tokens = tokenize(line);
  const flushCurrent = () => {
    if (current.trim().length > 0 || committed.length === 0) {
      committed.push(current.trimEnd());
    }
    current = '';
    currentWidth = 0;
  };

  for (const token of tokens) {
    const tokenIsWhitespace = token.trim().length === 0;
    const tokenWidth = measureRun(token, fontSize, letterSpacing);

    if (tokenIsWhitespace && current === '') {
      continue;
    }

    if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
      flushCurrent();
      if (tokenIsWhitespace) {
        continue;
      }

      if (tokenWidth > maxWidth) {
        const chars = Array.from(token);
        let wordBuffer = '';
        let wordWidth = 0;
        for (const char of chars) {
          const charWidth = measureRun(char, fontSize, letterSpacing);
          if (wordWidth > 0 && wordWidth + charWidth > maxWidth) {
            committed.push(wordBuffer);
            wordBuffer = char;
            wordWidth = charWidth;
          } else {
            wordBuffer += char;
            wordWidth += charWidth;
          }
        }
        current = wordBuffer;
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

export function measureWrappedText({
  text,
  maxWidth,
  fontSize = DEFAULT_FONT_SIZE,
  letterSpacing = DEFAULT_LETTER_SPACING,
  lineGap = DEFAULT_LINE_GAP,
}: MeasureWrappedTextOptions): MeasureWrappedTextResult {
  const normalized = normalizeText(text);
  const baseLines = normalized.split('\n');
  const wrappedLines = baseLines.flatMap((line) =>
    line.length === 0 ? [''] : wrapLine(line, maxWidth, fontSize, letterSpacing)
  );

  const lineCount = wrappedLines.length;
  const totalHeight =
    lineCount === 0
      ? 0
      : lineCount * fontSize + Math.max(0, lineCount - 1) * lineGap;

  return {
    lines: wrappedLines,
    lineCount,
    totalHeight,
  };
}

export function FontText({
  text,
  color = DEFAULT_COLOR,
  fontSize = DEFAULT_FONT_SIZE,
  letterSpacing = DEFAULT_LETTER_SPACING,
  align = 'center',
}: FontTextProps): JSX.Element {
  const normalized = normalizeText(text);
  const glyphs = Array.from(normalized);

  const measurements = glyphs.map((char) => {
    const codePoint = char.codePointAt(0) ?? 32;
    return measureGlyph(codePoint, fontSize, letterSpacing);
  });

  return (
    <hstack alignment={horizontalAlignment(align)} gap="none">
      {measurements.map((measurement, index) =>
        renderGlyph(measurement, index, fontSize, color)
      )}
    </hstack>
  );
}

export function WrappedFontText({
  text,
  maxWidth,
  lineGap = DEFAULT_LINE_GAP,
  color = DEFAULT_COLOR,
  fontSize = DEFAULT_FONT_SIZE,
  letterSpacing = DEFAULT_LETTER_SPACING,
  align = 'center',
}: WrappedFontTextProps): JSX.Element {
  const normalized = normalizeText(text);
  const baseLines = normalized.split('\n');
  const wrappedLines = baseLines.flatMap((line) =>
    line.length === 0 ? [''] : wrapLine(line, maxWidth, fontSize, letterSpacing)
  );

  const children: JSX.Element[] = [];
  wrappedLines.forEach((line, index) => {
    children.push(
      <FontText
        text={line}
        color={color}
        fontSize={fontSize}
        letterSpacing={letterSpacing}
        align={align}
      />
    );
    if (index < wrappedLines.length - 1) {
      children.push(<spacer key={`gap-${index}`} height={`${lineGap}px`} />);
    }
  });

  return (
    <vstack alignment={verticalStackAlignment(align)} gap="none">
      {children}
    </vstack>
  );
}
