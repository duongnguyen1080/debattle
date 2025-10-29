#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const iconsPath = path.join(projectRoot, 'src', 'icons.ts');
const outputPath = path.join(projectRoot, 'src', 'utils', 'answerFontGlyphMetrics.ts');

const entryRegex = /"Merriweather_Regular\/(\d+)\.svg":\s*svg`([\s\S]*?)`/g;

const source = readFileSync(iconsPath, 'utf8');
const glyphEntries = [];

for (const match of source.matchAll(entryRegex)) {
  const codePoint = Number(match[1]);
  const svg = match[2];
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    console.warn(`[generate-answer-font-metrics] Missing viewBox for code point ${codePoint}`);
    continue;
  }
  const [, viewBox] = viewBoxMatch;
  const parts = viewBox.trim().split(/\s+/);
  if (parts.length < 4) {
    console.warn(`[generate-answer-font-metrics] Unexpected viewBox for code point ${codePoint}: ${viewBox}`);
    continue;
  }
  const width = Number(parts[2]);
  if (Number.isNaN(width)) {
    console.warn(`[generate-answer-font-metrics] Invalid width for code point ${codePoint}: ${parts[2]}`);
    continue;
  }
  glyphEntries.push([codePoint, width]);
}

glyphEntries.sort((a, b) => a[0] - b[0]);

const lines = glyphEntries.map(([code, width]) => `  ${code}: ${width},`).join('\n');
const header =
  '// Auto-generated from src/icons.ts viewBox metrics for Merriweather.\n' +
  '// Run `npm run glyphs:answer` after updating the font assets.\n' +
  'export const ANSWER_FONT_GLYPH_WIDTHS: Record<number, number> = {\n';
const footer =
  '};\n\n' +
  'export const ANSWER_FONT_MAX_WIDTH = Math.max(...Object.values(ANSWER_FONT_GLYPH_WIDTHS));\n';

writeFileSync(outputPath, `${header}${lines}\n${footer}`);

console.log(
  `[generate-answer-font-metrics] wrote ${glyphEntries.length} glyph widths to ${path.relative(
    projectRoot,
    outputPath
  )}`
);
