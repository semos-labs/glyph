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

export function paintTree(
  roots: GlyphNode[],
  fb: Framebuffer,
  cursorInfo?: { nodeId: string; position: number },
): void {
  fb.clear();

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
    paintNode(entry.node, fb, entry.clip, cursorInfo);
  }
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
  cursorInfo?: { nodeId: string; position: number },
): void {
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
    paintInput(node, fb, clip, cursorInfo);
  }
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
  cursorInfo?: { nodeId: string; position: number },
): void {
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;
  if (innerWidth <= 0 || innerHeight <= 0) return;

  const value: string = node.props.value ?? node.props.defaultValue ?? "";
  const placeholder: string = node.props.placeholder ?? "";
  const displayText = value || placeholder;
  const isPlaceholder = !value && !!placeholder;
  const inherited = getInheritedTextStyle(node);

  const autoFg = autoContrastFg(inherited.color, inherited.bg);
  const fg = isPlaceholder
    ? (node.style.color ?? inherited.color ?? "blackBright")
    : (autoFg ?? inherited.color ?? node.style.color);

  // Draw text
  let col = 0;
  for (const char of displayText) {
    if (col >= innerWidth) break;
    const charWidth = stringWidth(char);
    if (charWidth > 0) {
      setClipped(
        fb, clip,
        innerX + col, innerY,
        char,
        isPlaceholder ? "blackBright" : fg,
        inherited.bg,
        inherited.bold,
        inherited.dim,
        inherited.italic,
        inherited.underline,
      );
    }
    col += charWidth;
  }

  // Cursor
  if (cursorInfo && cursorInfo.nodeId === node.focusId) {
    const cursorCol = Math.min(cursorInfo.position, innerWidth - 1);
    const cursorX = innerX + cursorCol;
    if (isInClip(cursorX, innerY, clip) && cursorX < innerX + innerWidth) {
      const existing = fb.get(cursorX, innerY);
      if (existing) {
        // Invert cell for cursor visibility
        fb.setChar(
          cursorX, innerY,
          existing.ch === " " ? "▏" : existing.ch,
          existing.bg ?? "black",
          existing.fg ?? "white",
          existing.bold,
          existing.dim,
          existing.italic,
          true, // underline cursor
        );
      }
    }
  }
}
