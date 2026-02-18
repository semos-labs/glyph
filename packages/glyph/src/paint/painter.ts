import type { GlyphNode, TextSegment } from "../reconciler/nodes.js";
import { getInheritedTextStyle, collectTextContent, collectStyledSegments } from "../reconciler/nodes.js";
import type { Cell } from "./framebuffer.js";
import { Framebuffer } from "./framebuffer.js";
import { getBorderChars } from "./borders.js";
import { isLightColor } from "./color.js";
import type { Color, ResolvedStyle } from "../types/index.js";
import { wrapLines } from "../layout/textMeasure.js";
import { ttyStringWidth, ttyCharWidth } from "../utils/ttyWidth.js";
import { parseAnsi, stripAnsi } from "./ansi.js";

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
  /** Background color at cursor position for contrast calculation */
  bg?: Color;
}

export interface PaintOptions {
  cursorInfo?: { nodeId: string; position: number };
  /** If true, don't paint the cursor and return its screen position instead */
  useNativeCursor?: boolean;
  /** If true, clear framebuffer and paint everything. If false, only paint dirty nodes. */
  fullRedraw?: boolean;
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
  const full = options.fullRedraw ?? true;

  if (full) {
    fb.clear();
  }

  const result: PaintResult = {};

  // Collect all nodes with their z-index for proper ordering
  const entries: PaintEntry[] = [];
  const screenClip: ClipRect = { x: 0, y: 0, width: fb.width, height: fb.height };

  for (const root of roots) {
    if (root.hidden) continue;
    collectPaintEntries(root, screenClip, root.resolvedStyle.zIndex ?? 0, entries);
  }

  // Sort by zIndex (stable sort preserves tree order within same z)
  entries.sort((a, b) => a.zIndex - b.zIndex);

  // Paint each entry
  for (const entry of entries) {
    const node = entry.node;

    // On incremental frames, skip nodes whose content hasn't changed
    if (!full && !node._paintDirty) continue;

    // On incremental frames, clear text/input inner area first
    // (old characters past the end of new text would otherwise linger)
    if (!full && (node.type === "text" || node.type === "input")) {
      const { innerX, innerY, innerWidth, innerHeight } = node.layout;
      const inherited = getInheritedTextStyle(node);
      for (let row = innerY; row < innerY + innerHeight; row++) {
        for (let col = innerX; col < innerX + innerWidth; col++) {
          if (isInClip(col, row, entry.clip)) {
            fb.setChar(col, row, " ", undefined, inherited.bg);
          }
        }
      }
    }

    const nodeResult = paintNode(node, fb, entry.clip, options);
    node._paintDirty = false;

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

  const zIndex = node.resolvedStyle.zIndex ?? parentZ;

  // Clip rect for THIS node's own painting (bg, border, text).
  // Uses parentClip so the node can paint within its parent's bounds.
  entries.push({ node, clip: parentClip, zIndex });

  // Clip rect for CHILDREN.
  // Only clip when the node explicitly opts in via `clip: true`
  // (e.g. ScrollView).  Without it, children are free to paint outside
  // the parent — which is required for absolute-positioned overlays
  // like Select dropdowns, tooltips, and dialogs.
  // The full-screen clear on resize (`\x1b[2J` in diff.ts) handles
  // stale pixels from layout shifts, so forced clipping isn't needed.
  const childClip = node.resolvedStyle.clip
    ? intersectClip(parentClip, {
      x: node.layout.innerX,
      y: node.layout.innerY,
      width: node.layout.innerWidth,
      height: node.layout.innerHeight,
    })
    : parentClip;

  // Children - skip for text/input (leaf nodes for painting)
  if (node.type !== "text" && node.type !== "input") {
    for (const child of node.children) {
      collectPaintEntries(child, childClip, zIndex, entries);
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
  const style = node.resolvedStyle;

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

  // 2. Clip-area fill: when a node has clip: true (e.g., ScrollView),
  // explicitly fill the entire inner area with the background.
  // This guarantees the viewport is fully overwritten every frame,
  // preventing ghost content when children shrink or move on state changes.
  // Use inherited bg as fallback so we don't erase a parent's background
  // with undefined (which would show through as the terminal default black).
  if (style.clip && innerWidth > 0 && innerHeight > 0) {
    const fillBg = style.bg ?? effectiveBg;
    for (let row = innerY; row < innerY + innerHeight; row++) {
      for (let col = innerX; col < innerX + innerWidth; col++) {
        if (isInClip(col, row, clip)) {
          fb.setChar(col, row, " ", undefined, fillBg);
        }
      }
    }
  }

  // 3. Border
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

  // 4. Text content
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
    // Wide characters (CJK, supplementary-plane emoji) occupy 2 terminal
    // cells.  Mark the trailing cell as a continuation so the diff engine
    // doesn't overwrite the right half of the glyph.
    const w = ttyCharWidth(ch);
    if (w === 2 && isInClip(x + 1, y, clip)) {
      fb.setChar(x + 1, y, "", fg, bg, bold, dim, italic, underline);
    }
  }
}

function autoContrastFg(explicitColor: Color | undefined, bg: Color | undefined): Color | undefined {
  if (explicitColor !== undefined) return explicitColor;
  if (bg === undefined) return undefined;
  return isLightColor(bg) ? "black" : "white";
}

/** A character with its associated style for painting */
interface StyledChar {
  char: string;
  style: TextSegment["style"];
}

function paintText(node: GlyphNode, fb: Framebuffer, clip: ClipRect): void {
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;
  const inherited = getInheritedTextStyle(node);
  
  // Collect styled segments from the nested text tree
  const segments = collectStyledSegments(node, inherited);
  if (segments.length === 0) return;
  
  const wrapMode = node.resolvedStyle.wrap ?? "wrap";
  const textAlign = node.resolvedStyle.textAlign ?? "left";
  
  // Build a flat array of styled characters, preserving style per character
  // Also track newlines for proper line handling
  const styledChars: StyledChar[] = [];
  const lineBreaks: number[] = []; // Indices where newlines occur
  
  for (const segment of segments) {
    // Parse ANSI codes within the segment text
    const ansiSegments = parseAnsi(segment.text);
    
    for (const ansiSeg of ansiSegments) {
      for (const char of ansiSeg.text) {
        if (char === "\n") {
          lineBreaks.push(styledChars.length);
        } else {
          // Merge segment style with ANSI style (ANSI takes precedence)
          const mergedStyle: TextSegment["style"] = {
            color: ansiSeg.style.fg ?? segment.style.color,
            bg: ansiSeg.style.bg ?? segment.style.bg,
            bold: ansiSeg.style.bold ?? segment.style.bold,
            dim: ansiSeg.style.dim ?? segment.style.dim,
            italic: ansiSeg.style.italic ?? segment.style.italic,
            underline: ansiSeg.style.underline ?? segment.style.underline,
          };
          styledChars.push({ char, style: mergedStyle });
        }
      }
    }
  }
  
  // Split into lines at line breaks
  const lines: StyledChar[][] = [];
  let lineStart = 0;
  for (const breakIdx of lineBreaks) {
    lines.push(styledChars.slice(lineStart, breakIdx));
    lineStart = breakIdx;
  }
  lines.push(styledChars.slice(lineStart)); // Last line (or only line if no breaks)
  
  // Wrap each line and track styled chars
  const wrappedLines: StyledChar[][] = [];
  
  for (const line of lines) {
    if (line.length === 0) {
      wrappedLines.push([]);
      continue;
    }
    
    // Get plain text for wrapping calculation
    const plainText = line.map(sc => sc.char).join("");
    const wrapped = wrapLines([plainText], innerWidth, wrapMode);
    
    // Map wrapped lines back to styled chars
    let charIdx = 0;
    for (const wrappedText of wrapped) {
      const wrappedLine: StyledChar[] = [];
      for (const char of wrappedText) {
        if (charIdx < line.length) {
          wrappedLine.push(line[charIdx]!);
          charIdx++;
        }
      }
      wrappedLines.push(wrappedLine);
    }
  }
  
  // Paint each wrapped line
  for (let lineIdx = 0; lineIdx < wrappedLines.length && lineIdx < innerHeight; lineIdx++) {
    const line = wrappedLines[lineIdx]!;
    const visibleWidth = line.reduce((sum, sc) => sum + ttyCharWidth(sc.char), 0);
    
    let offsetX = 0;
    if (textAlign === "center") {
      offsetX = Math.max(0, Math.floor((innerWidth - visibleWidth) / 2));
    } else if (textAlign === "right") {
      offsetX = Math.max(0, innerWidth - visibleWidth);
    }
    
    let col = 0;
    for (const { char, style } of line) {
      const charWidth = ttyCharWidth(char);
      if (charWidth > 0) {
        const fg = autoContrastFg(style.color, style.bg);
        setClipped(
          fb, clip,
          innerX + offsetX + col, innerY + lineIdx,
          char,
          fg, style.bg, style.bold, style.dim, style.italic, style.underline,
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
    : (autoFg ?? inherited.color ?? node.resolvedStyle.color);
  const textFg = isPlaceholder ? placeholderFg : fg;
  // Force dim for placeholder text to make it visually distinct
  const textDim = isPlaceholder ? true : inherited.dim;

  const isFocused = cursorInfo && cursorInfo.nodeId === node.focusId;
  let result: PaintResult | undefined;

  if (multiline && !isPlaceholder) {
    // ── Multiline rendering with wrapping ─────────────────────
    const wrapMode = node.resolvedStyle.wrap ?? "wrap";
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
      cursorScreenCol = ttyStringWidth(rawLines[logicalLine]!.slice(charsProcessed, charsProcessed + (offsetInLogicalLine - charsProcessed)));
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
        const charWidth = ttyCharWidth(char);
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
            result = { cursorPosition: { x: cursorX, y: cursorY, bg: inherited.bg } };
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
      const charWidth = ttyCharWidth(char);
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
          result = { cursorPosition: { x: cursorX, y: innerY, bg: inherited.bg } };
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
