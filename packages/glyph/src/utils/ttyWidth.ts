/**
 * Terminal-aware character and string width calculation.
 *
 * Replaces `string-width` which incorrectly treats many BMP
 * emoji-capable characters (↗, ✓, ♥, ⚡, ☀ …) as width 2.
 * Terminals render these as 1 cell.  Only genuine CJK / fullwidth
 * characters and supplementary-plane emoji (above U+FFFF) are 2 cells.
 *
 * @module ttyWidth
 */

import { stripAnsi } from "../paint/ansi.js";

// Intl.Segmenter gives us proper grapheme-cluster segmentation,
// so multi-codepoint emoji sequences (👨‍👩‍👧, 🇺🇸) are a single segment.
const segmenter = new Intl.Segmenter();

/**
 * Return the display width (0, 1, or 2 cells) of a single Unicode codepoint.
 *
 * This follows the POSIX `wcwidth` convention used by virtually every
 * terminal emulator:
 *
 * | Range | Width | Examples |
 * |-------|-------|----------|
 * | C0 / C1 control | 0 | `\x00`–`\x1F`, `\x7F`–`\x9F` |
 * | Combining marks | 0 | U+0300–U+036F, … |
 * | Zero-width chars | 0 | U+200B–U+200F, U+FEFF, U+FE00–U+FE0F |
 * | CJK / Fullwidth / Wide | 2 | CJK ideographs, Hangul, fullwidth Latin |
 * | Everything else in BMP | 1 | Latin, Cyrillic, arrows, symbols, BMP emoji |
 *
 * Supplementary-plane characters (codepoint > U+FFFF) are handled
 * at the grapheme-cluster level in {@link ttyStringWidth}.
 */
function codepointWidth(cp: number): number {
  // ── Zero-width ────────────────────────────────────────────
  // C0 control
  if (cp <= 0x1f) return 0;
  // C1 control
  if (cp >= 0x7f && cp <= 0x9f) return 0;

  // Common combining diacritical marks & extensions
  if (cp >= 0x0300 && cp <= 0x036f) return 0;
  if (cp >= 0x0483 && cp <= 0x0489) return 0;
  if (cp >= 0x0591 && cp <= 0x05bd) return 0;
  if (cp === 0x05bf) return 0;
  if (cp >= 0x05c1 && cp <= 0x05c2) return 0;
  if (cp >= 0x05c4 && cp <= 0x05c5) return 0;
  if (cp === 0x05c7) return 0;
  if (cp >= 0x0610 && cp <= 0x061a) return 0;
  if (cp >= 0x064b && cp <= 0x065f) return 0;
  if (cp === 0x0670) return 0;
  if (cp >= 0x06d6 && cp <= 0x06dc) return 0;
  if (cp >= 0x06df && cp <= 0x06e4) return 0;
  if (cp >= 0x06e7 && cp <= 0x06e8) return 0;
  if (cp >= 0x06ea && cp <= 0x06ed) return 0;
  if (cp === 0x0711) return 0;
  if (cp >= 0x0730 && cp <= 0x074a) return 0;
  if (cp >= 0x07a6 && cp <= 0x07b0) return 0;
  if (cp >= 0x0901 && cp <= 0x0903) return 0;
  if (cp === 0x093c) return 0;
  if (cp >= 0x093e && cp <= 0x094d) return 0;
  if (cp >= 0x0951 && cp <= 0x0954) return 0;
  if (cp >= 0x0962 && cp <= 0x0963) return 0;
  if (cp >= 0x0981 && cp <= 0x0983) return 0;
  if (cp === 0x09bc) return 0;
  if (cp >= 0x09be && cp <= 0x09cd) return 0;
  if (cp === 0x09d7) return 0;
  if (cp >= 0x09e2 && cp <= 0x09e3) return 0;
  if (cp >= 0x0a01 && cp <= 0x0a03) return 0;
  if (cp === 0x0a3c) return 0;
  if (cp >= 0x0a3e && cp <= 0x0a4d) return 0;
  if (cp >= 0x0a70 && cp <= 0x0a71) return 0;
  if (cp >= 0x0a81 && cp <= 0x0a83) return 0;
  if (cp === 0x0abc) return 0;
  if (cp >= 0x0abe && cp <= 0x0acd) return 0;
  if (cp >= 0x0ae2 && cp <= 0x0ae3) return 0;
  if (cp >= 0x0b01 && cp <= 0x0b03) return 0;
  if (cp === 0x0b3c) return 0;
  if (cp >= 0x0b3e && cp <= 0x0b57) return 0;
  if (cp >= 0x0b82 && cp <= 0x0b83) return 0;
  if (cp >= 0x0bbe && cp <= 0x0bcd) return 0;
  if (cp === 0x0bd7) return 0;
  if (cp >= 0x0c01 && cp <= 0x0c03) return 0;
  if (cp >= 0x0c3e && cp <= 0x0c56) return 0;
  if (cp >= 0x0c82 && cp <= 0x0c83) return 0;
  if (cp >= 0x0cbe && cp <= 0x0cd6) return 0;
  if (cp >= 0x0d02 && cp <= 0x0d03) return 0;
  if (cp >= 0x0d3e && cp <= 0x0d57) return 0;
  if (cp >= 0x0d82 && cp <= 0x0d83) return 0;
  if (cp >= 0x0dca && cp <= 0x0df3) return 0;
  if (cp === 0x0e31) return 0;
  if (cp >= 0x0e34 && cp <= 0x0e3a) return 0;
  if (cp >= 0x0e47 && cp <= 0x0e4e) return 0;
  if (cp === 0x0eb1) return 0;
  if (cp >= 0x0eb4 && cp <= 0x0ebc) return 0;
  if (cp >= 0x0ec8 && cp <= 0x0ecd) return 0;
  if (cp >= 0x0f18 && cp <= 0x0f19) return 0;
  if (cp === 0x0f35) return 0;
  if (cp === 0x0f37) return 0;
  if (cp === 0x0f39) return 0;
  if (cp >= 0x0f3e && cp <= 0x0f3f) return 0;
  if (cp >= 0x0f71 && cp <= 0x0f84) return 0;
  if (cp >= 0x0f86 && cp <= 0x0f87) return 0;
  if (cp >= 0x0f90 && cp <= 0x0fbc) return 0;
  if (cp === 0x0fc6) return 0;
  if (cp >= 0x1000 && cp <= 0x1059) {
    // Myanmar — spacing marks in this range are width 1, combining are 0
    // Simplify: only known combining marks
    if (cp >= 0x102b && cp <= 0x103e) return 0;
    if (cp >= 0x1056 && cp <= 0x1059) return 0;
  }
  if (cp >= 0x1712 && cp <= 0x1714) return 0;
  if (cp >= 0x1732 && cp <= 0x1734) return 0;
  if (cp >= 0x1752 && cp <= 0x1753) return 0;
  if (cp >= 0x1772 && cp <= 0x1773) return 0;
  if (cp >= 0x17b4 && cp <= 0x17d3) return 0;
  if (cp === 0x17dd) return 0;
  if (cp >= 0x180b && cp <= 0x180d) return 0;
  if (cp >= 0x1920 && cp <= 0x193b) return 0;
  if (cp >= 0x1a17 && cp <= 0x1a1b) return 0;
  if (cp >= 0x1ab0 && cp <= 0x1aff) return 0;
  if (cp >= 0x1dc0 && cp <= 0x1dff) return 0;
  if (cp >= 0x20d0 && cp <= 0x20ff) return 0;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 0; // Variation selectors
  if (cp >= 0xfe20 && cp <= 0xfe2f) return 0; // Combining half marks

  // Zero-width spaces / format characters
  if (cp >= 0x200b && cp <= 0x200f) return 0;
  if (cp >= 0x2028 && cp <= 0x202e) return 0;
  if (cp >= 0x2060 && cp <= 0x2069) return 0;
  if (cp === 0xfeff) return 0;

  // Soft hyphen
  if (cp === 0x00ad) return 0;

  // ── Width 2: CJK / Fullwidth / Wide ──────────────────────
  // Hangul Jamo
  if (cp >= 0x1100 && cp <= 0x115f) return 2;
  if (cp >= 0x2329 && cp <= 0x232a) return 2; // Angle brackets
  // CJK Radicals Supplement .. CJK Symbols and Punctuation
  if (cp >= 0x2e80 && cp <= 0x303e) return 2;
  // Hiragana .. Katakana .. Bopomofo .. Hangul Compat Jamo .. Kanbun .. Bopomofo Extended .. CJK Strokes .. Katakana Phonetic Ext .. Enclosed CJK
  if (cp >= 0x3040 && cp <= 0x33bf) return 2;
  // CJK Unified Ideographs Extension A
  if (cp >= 0x3400 && cp <= 0x4dbf) return 2;
  // CJK Unified Ideographs
  if (cp >= 0x4e00 && cp <= 0x9fff) return 2;
  // Yi Syllables + Yi Radicals
  if (cp >= 0xa000 && cp <= 0xa4cf) return 2;
  // Hangul Jamo Extended-A
  if (cp >= 0xa960 && cp <= 0xa97c) return 2;
  // Hangul Syllables
  if (cp >= 0xac00 && cp <= 0xd7a3) return 2;
  // CJK Compatibility Ideographs
  if (cp >= 0xf900 && cp <= 0xfaff) return 2;
  // Vertical forms
  if (cp >= 0xfe10 && cp <= 0xfe19) return 2;
  // CJK Compatibility Forms
  if (cp >= 0xfe30 && cp <= 0xfe6b) return 2;
  // Fullwidth forms
  if (cp >= 0xff01 && cp <= 0xff60) return 2;
  // Fullwidth signs
  if (cp >= 0xffe0 && cp <= 0xffe6) return 2;

  // ── Everything else in BMP: width 1 ──────────────────────
  return 1;
}

/**
 * Compute the display width of a single grapheme cluster.
 *
 * Multi-codepoint sequences (emoji ZWJ sequences like 👨‍👩‍👧,
 * flags like 🇺🇸) are treated as width 2.
 *
 * @param segment - A single grapheme cluster (from `Intl.Segmenter`).
 * @returns 0, 1, or 2.
 */
function graphemeWidth(segment: string): number {
  const cp = segment.codePointAt(0);
  if (cp === undefined) return 0;

  // Multi-character grapheme clusters (emoji sequences, flags) → width 2
  // We use a threshold: if the segment has multiple codepoints beyond
  // combining marks, it's an emoji sequence.
  if (segment.length > 2) return 2; // surrogate pair(s) + joiners = emoji sequence

  // Supplementary plane (above BMP) — genuine wide emoji & CJK Extension B+
  if (cp > 0xffff) return 2;

  return codepointWidth(cp);
}

/**
 * Compute the display width of a string as rendered in a terminal.
 *
 * Handles ANSI escape codes (stripped), grapheme clusters (emoji sequences),
 * and uses terminal-accurate character widths instead of the over-eager
 * emoji classification in `string-width` v7.
 *
 * Drop-in replacement for `string-width`.
 *
 * @param str - The string to measure.
 * @returns Terminal cell count.
 *
 * @example
 * ```ts
 * ttyStringWidth("hello")         // 5
 * ttyStringWidth("↗ docs")        // 6  (string-width returns 7!)
 * ttyStringWidth("文字")           // 4  (CJK, correctly 2 each)
 * ttyStringWidth("\x1b[31mred\x1b[0m") // 3  (ANSI stripped)
 * ```
 * @category Core
 */
export function ttyStringWidth(str: string): number {
  if (str.length === 0) return 0;

  // Strip ANSI escape codes
  str = stripAnsi(str);
  if (str.length === 0) return 0;

  let width = 0;

  for (const { segment } of segmenter.segment(str)) {
    width += graphemeWidth(segment);
  }

  return width;
}

/**
 * Compute the display width of a single character in a terminal cell.
 *
 * Fast-paths ASCII (always 1) and uses {@link codepointWidth} for
 * non-ASCII.  Used by the diff engine for cursor tracking.
 *
 * @param ch - A single character (may be a grapheme cluster).
 * @returns 0, 1, or 2.
 *
 * @example
 * ```ts
 * ttyCharWidth("a")  // 1
 * ttyCharWidth("文") // 2
 * ttyCharWidth("↗")  // 1
 * ```
 * @category Core
 */
export function ttyCharWidth(ch: string): number {
  if (ch.length === 0) return 0;
  // ASCII fast path
  if (ch.length === 1 && ch.charCodeAt(0) < 128) return 1;
  return graphemeWidth(ch);
}
