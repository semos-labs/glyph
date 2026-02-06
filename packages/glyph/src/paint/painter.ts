import type { GlyphNode } from "../reconciler/nodes.js";
import { getInheritedTextStyle, collectTextContent } from "../reconciler/nodes.js";
import type { Cell } from "./framebuffer.js";
import { Framebuffer } from "./framebuffer.js";
import { getBorderChars } from "./borders.js";
import { isLightColor } from "./color.js";
import type { Color, Style } from "../types/index.js";
import { wrapLines } from "../layout/textMeasure.js";
import stringWidth from "string-width";

interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaintEntry {
  node: GlyphNode;
  clip: ClipRect;
  zIndex: number;
}

export interface CursorScreenPosition {
  x: number;
  y: number;
}

export interface PaintOptions {
  cursorInfo?: { nodeId: string; position: number };
  /** If true, don't paint the cursor and return its screen position instead */
  useNativeCursor?: boolean;
}

export interface PaintResult {
  /** Cursor screen position if useNativeCursor is true and an input is focused */
  cursorPosition?: CursorScreenPosition;
}

export function paintTree(
  roots: GlyphNode[],
  fb: Framebuffer,
  options: PaintOptions = {},
): PaintResult {
  fb.clear();

  const result: PaintResult = {};

  // Collect all nodes with their z-index for proper ordering
  const entries: PaintEntry[] = [];
  const screenClip: ClipRect = { x: 0, y: 0, width: fb.width, height: fb.height };

  for (const root of roots) {
    if (root.hidden) continue;
    collectPaintEntries(root, screenClip, root.style.zIndex ?? 0, entries);
  }

  // Sort by zIndex (stable sort preserves tree order within same z)
  entries.sort((a, b) => a.zIndex - b.zIndex);

  // Paint each entry
  for (const entry of entries) {
    const nodeResult = paintNode(entry.node, fb, entry.clip, options);
    // Capture cursor position from the focused input
    if (nodeResult?.cursorPosition) {
      result.cursorPosition = nodeResult.cursorPosition;
    }
  }

  return result;
}

function collectPaintEntries(
  node: GlyphNode,
  parentClip: ClipRect,
  parentZ: number,
  entries: PaintEntry[],
): void {
  if (node.hidden) return;

  const zIndex = node.style.zIndex ?? parentZ;

  // Compute clip for this node
  const clip = node.style.clip ? intersectClip(parentClip, {
    x: node.layout.innerX,
    y: node.layout.innerY,
    width: node.layout.innerWidth,
    height: node.layout.innerHeight,
  }) : parentClip;

  entries.push({ node, clip: parentClip, zIndex });

  // Children - skip for text/input (leaf nodes for painting)
  if (node.type !== "text" && node.type !== "input") {
    for (const child of node.children) {
      collectPaintEntries(child, clip, zIndex, entries);
    }
  }
}

function intersectClip(a: ClipRect, b: ClipRect): ClipRect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function isInClip(x: number, y: number, clip: ClipRect): boolean {
  return x >= clip.x && x < clip.x + clip.width && y >= clip.y && y < clip.y + clip.height;
}

function paintNode(
  node: GlyphNode,
  fb: Framebuffer,
  clip: ClipRect,
  options: PaintOptions = {},
): PaintResult | undefined {
  const { x, y, width, height, innerX, innerY, innerWidth, innerHeight } = node.layout;
  const style = node.style;

  if (width <= 0 || height <= 0) return;

  // Resolve inherited bg so borders and fills don't erase a parent's background
  const inherited = getInheritedTextStyle(node);
  const effectiveBg = inherited.bg;

  // 1. Background fill
  if (style.bg) {
    for (let row = y; row < y + height; row++) {
      for (let col = x; col < x + width; col++) {
        if (isInClip(col, row, clip)) {
          fb.setChar(col, row, " ", undefined, style.bg);
        }
      }
    }
  }

  // 2. Border
  const borderChars = style.border ? getBorderChars(style.border) : null;
  if (borderChars && width >= 2 && height >= 2) {
    const bc = style.borderColor;
    const bg = effectiveBg;

    // Top border
    setClipped(fb, clip, x, y, borderChars.topLeft, bc, bg);
    for (let col = x + 1; col < x + width - 1; col++) {
      setClipped(fb, clip, col, y, borderChars.horizontal, bc, bg);
    }
    setClipped(fb, clip, x + width - 1, y, borderChars.topRight, bc, bg);

    // Bottom border
    setClipped(fb, clip, x, y + height - 1, borderChars.bottomLeft, bc, bg);
    for (let col = x + 1; col < x + width - 1; col++) {
      setClipped(fb, clip, col, y + height - 1, borderChars.horizontal, bc, bg);
    }
    setClipped(fb, clip, x + width - 1, y + height - 1, borderChars.bottomRight, bc, bg);

    // Side borders
    for (let row = y + 1; row < y + height - 1; row++) {
      setClipped(fb, clip, x, row, borderChars.vertical, bc, bg);
      setClipped(fb, clip, x + width - 1, row, borderChars.vertical, bc, bg);
    }
  }

  // 3. Text content
  if (node.type === "text") {
    paintText(node, fb, clip);
  } else if (node.type === "input") {
    return paintInput(node, fb, clip, options);
  }

  return undefined;
}

function setClipped(
  fb: Framebuffer,
  clip: ClipRect,
  x: number,
  y: number,
  ch: string,
  fg?: Color,
  bg?: Color,
  bold?: boolean,
  dim?: boolean,
  italic?: boolean,
  underline?: boolean,
): void {
  if (isInClip(x, y, clip)) {
    fb.setChar(x, y, ch, fg, bg, bold, dim, italic, underline);
  }
}

function autoContrastFg(explicitColor: Color | undefined, bg: Color | undefined): Color | undefined {
  if (explicitColor !== undefined) return explicitColor;
  if (bg === undefined) return undefined;
  return isLightColor(bg) ? "black" : "white";
}

function paintText(node: GlyphNode, fb: Framebuffer, clip: ClipRect): void {
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;
  const inherited = getInheritedTextStyle(node);
  const text = collectTextContent(node);
  if (!text) return;

  const fg = autoContrastFg(inherited.color, inherited.bg);
  const wrapMode = node.style.wrap ?? "wrap";
  const textAlign = node.style.textAlign ?? "left";
  const rawLines = text.split("\n");
  const lines = wrapLines(rawLines, innerWidth, wrapMode);

  for (let lineIdx = 0; lineIdx < lines.length && lineIdx < innerHeight; lineIdx++) {
    const line = lines[lineIdx]!;
    const lineWidth = stringWidth(line);
    let offsetX = 0;

    if (textAlign === "center") {
      offsetX = Math.max(0, Math.floor((innerWidth - lineWidth) / 2));
    } else if (textAlign === "right") {
      offsetX = Math.max(0, innerWidth - lineWidth);
    }

    let col = 0;
    for (const char of line) {
      const charWidth = stringWidth(char);
      if (charWidth > 0) {
        setClipped(
          fb, clip,
          innerX + offsetX + col, innerY + lineIdx,
          char,
          fg,
          inherited.bg,
          inherited.bold,
          inherited.dim,
          inherited.italic,
          inherited.underline,
        );
      }
      col += charWidth;
    }
  }
}

function paintInput(
  node: GlyphNode,
  fb: Framebuffer,
  clip: ClipRect,
  options: PaintOptions = {},
): PaintResult | undefined {
  const { cursorInfo, useNativeCursor } = options;
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;
  if (innerWidth <= 0 || innerHeight <= 0) return;

  const value: string = node.props.value ?? node.props.defaultValue ?? "";
  const placeholder: string = node.props.placeholder ?? "";
  const displayText = value || placeholder;
  const isPlaceholder = !value && !!placeholder;
  const multiline: boolean = node.props.multiline ?? false;
  const inherited = getInheritedTextStyle(node);

  const autoFg = autoContrastFg(inherited.color, inherited.bg);
  // For placeholder: use a dimmed contrast color based on background
  // Light bg -> dark gray placeholder, dark bg -> light gray placeholder
  const placeholderFg: Color = inherited.bg 
    ? (isLightColor(inherited.bg) ? "blackBright" : "whiteBright")
    : "blackBright";
  const fg = isPlaceholder
    ? placeholderFg
    : (autoFg ?? inherited.color ?? node.style.color);
  const textFg = isPlaceholder ? placeholderFg : fg;
  // Force dim for placeholder text to make it visually distinct
  const textDim = isPlaceholder ? true : inherited.dim;

  const isFocused = cursorInfo && cursorInfo.nodeId === node.focusId;
  let result: PaintResult | undefined;

  if (multiline && !isPlaceholder) {
    // ── Multiline rendering with wrapping ─────────────────────
    const wrapMode = node.style.wrap ?? "wrap";
    const rawLines = displayText.split("\n");
    const wrappedLines = wrapLines(rawLines, innerWidth, wrapMode);

    // Convert flat cursor position to screen (wrappedLine, col)
    let cursorScreenLine = 0;
    let cursorScreenCol = 0;
    if (isFocused) {
      const pos = cursorInfo.position;
      
      // Find which logical line the cursor is on
      let logicalLine = 0;
      let offsetInLogicalLine = pos;
      let runningPos = 0;
      
      for (let i = 0; i < rawLines.length; i++) {
        const lineLen = rawLines[i]!.length;
        if (pos <= runningPos + lineLen) {
          logicalLine = i;
          offsetInLogicalLine = pos - runningPos;
          break;
        }
        runningPos += lineLen + 1; // +1 for newline
      }
      
      // Count wrapped lines before this logical line
      let wrappedLinesBefore = 0;
      for (let i = 0; i < logicalLine; i++) {
        wrappedLinesBefore += wrapLines([rawLines[i]!], innerWidth, wrapMode).length;
      }
      
      // Wrap the current logical line and find cursor position within it
      const wrappedCurrentLine = wrapLines([rawLines[logicalLine]!], innerWidth, wrapMode);
      let charsProcessed = 0;
      let subLineIdx = 0;
      
      for (let i = 0; i < wrappedCurrentLine.length; i++) {
        const subLine = wrappedCurrentLine[i]!;
        if (offsetInLogicalLine <= charsProcessed + subLine.length) {
          subLineIdx = i;
          break;
        }
        charsProcessed += subLine.length;
      }
      
      cursorScreenLine = wrappedLinesBefore + subLineIdx;
      cursorScreenCol = stringWidth(rawLines[logicalLine]!.slice(charsProcessed, charsProcessed + (offsetInLogicalLine - charsProcessed)));
    }

    // Auto-scroll to keep cursor visible
    const scrollOffset = Math.max(0, cursorScreenLine - innerHeight + 1);

    // Render visible wrapped lines
    for (let rowIdx = 0; rowIdx < innerHeight; rowIdx++) {
      const lineNum = scrollOffset + rowIdx;
      if (lineNum >= wrappedLines.length) break;
      const line = wrappedLines[lineNum]!;
      let col = 0;
      for (const char of line) {
        if (col >= innerWidth) break;
        const charWidth = stringWidth(char);
        if (charWidth > 0) {
          setClipped(
            fb, clip,
            innerX + col, innerY + rowIdx,
            char,
            textFg, inherited.bg,
            inherited.bold, textDim, inherited.italic, inherited.underline,
          );
        }
        col += charWidth;
      }
    }

    // Cursor handling
    if (isFocused) {
      const screenRow = cursorScreenLine - scrollOffset;
      if (screenRow >= 0 && screenRow < innerHeight) {
        const cCol = Math.min(cursorScreenCol, innerWidth - 1);
        const cursorX = innerX + cCol;
        const cursorY = innerY + screenRow;
        if (isInClip(cursorX, cursorY, clip) && cursorX < innerX + innerWidth) {
          if (useNativeCursor) {
            // Return cursor position for native cursor positioning
            result = { cursorPosition: { x: cursorX, y: cursorY } };
          } else {
            // Paint simulated cursor
            const existing = fb.get(cursorX, cursorY);
            const cursorChar = existing?.ch && existing.ch !== " " ? existing.ch : "▌";
            const cursorFg = inherited.bg ?? "black";
            const cursorBg = inherited.color ?? "white";
            fb.setChar(
              cursorX, cursorY,
              cursorChar,
              cursorFg,
              cursorBg,
              existing?.bold, existing?.dim, existing?.italic,
              false,
            );
          }
        }
      }
    }
  } else {
    // ── Single-line rendering ───────────────────────────────
    let col = 0;
    for (const char of displayText) {
      if (col >= innerWidth) break;
      const charWidth = stringWidth(char);
      if (charWidth > 0) {
        setClipped(
          fb, clip,
          innerX + col, innerY,
          char,
          textFg, inherited.bg,
          inherited.bold, textDim, inherited.italic, inherited.underline,
        );
      }
      col += charWidth;
    }

    // Cursor handling
    if (isFocused) {
      const cursorCol = Math.min(cursorInfo.position, innerWidth - 1);
      const cursorX = innerX + cursorCol;
      if (isInClip(cursorX, innerY, clip) && cursorX < innerX + innerWidth) {
        if (useNativeCursor) {
          // Return cursor position for native cursor positioning
          result = { cursorPosition: { x: cursorX, y: innerY } };
        } else {
          // Paint simulated cursor
          const existing = fb.get(cursorX, innerY);
          const cursorChar = existing?.ch && existing.ch !== " " ? existing.ch : "▌";
          const cursorFg = inherited.bg ?? "black";
          const cursorBg = inherited.color ?? "white";
          fb.setChar(
            cursorX, innerY,
            cursorChar,
            cursorFg,
            cursorBg,
            existing?.bold, existing?.dim, existing?.italic,
            false,
          );
        }
      }
    }
  }

  return result;
}
