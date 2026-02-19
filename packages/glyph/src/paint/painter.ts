import type { GlyphNode, TextSegment } from "../reconciler/nodes.js";
import { getInheritedTextStyle, collectTextContent, collectStyledSegments, pendingStaleRects } from "../reconciler/nodes.js";
import type { Cell } from "./framebuffer.js";
import { Framebuffer } from "./framebuffer.js";
import { getBorderChars } from "./borders.js";
import { isLightColor } from "./color.js";
import type { Color, ResolvedStyle } from "../types/index.js";
import { wrapLines } from "../layout/textMeasure.js";
import { ttyStringWidth, ttyCharWidth } from "../utils/ttyWidth.js";
import { parseAnsi, stripAnsi } from "./ansi.js";
import { framePerf as perf } from "../perf.js";

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
  /** Whether this node (or an ancestor) is dirty and needs repainting. */
  dirty: boolean;
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
    // Full redraw covers everything — no need for stale rect clearing
    pendingStaleRects.length = 0;
  }

  // Snapshot stale rects BEFORE collecting entries so collectPaintEntries
  // can check overlap and propagate ancestorDirty correctly through clip
  // containers (setting entry.dirty post-hoc doesn't propagate to children).
  let staleRectsSnapshot: typeof pendingStaleRects | null = null;
  if (!full && pendingStaleRects.length > 0) {
    staleRectsSnapshot = pendingStaleRects.slice();
  }

  const result: PaintResult = {};

  // Collect all nodes with their z-index for proper ordering
  const tCollect0 = performance.now();
  const entries: PaintEntry[] = [];
  const screenClip: ClipRect = { x: 0, y: 0, width: fb.width, height: fb.height };

  for (const root of roots) {
    if (root.hidden) continue;
    collectPaintEntries(root, screenClip, root.resolvedStyle.zIndex ?? 0, entries, false, staleRectsSnapshot);
  }
  perf.collectEntries = performance.now() - tCollect0;

  // Sort by zIndex (stable sort preserves tree order within same z)
  const tSort0 = performance.now();
  entries.sort((a, b) => a.zIndex - b.zIndex);
  perf.sortEntries = performance.now() - tSort0;

  perf.totalEntries = entries.length;
  let dirtyCount = 0;
  let preClearCells = 0;

  // Paint in two passes to prevent stale-area pre-clears from destroying
  // freshly painted sibling content.  When children are reordered or new
  // siblings are inserted (e.g. a sidebar appears, shifting EmailList right),
  // EmailList's old-position pre-clear overlaps the sidebar's new position.
  // In a single pass the sidebar paints first (tree order), then EmailList's
  // pre-clear wipes it.  Two passes fix this: clear ALL stale rects first,
  // then paint ALL nodes — the paint pass always has the final say.
  const tPaint0 = performance.now();

  // ── Pass 0: Clear areas of removed nodes ──
  // Nodes removed via removeChild are no longer in the tree, so they won't
  // appear in the entries list.  For absolute-positioned overlays (Select
  // dropdowns, tooltips, dialogs) the removed area falls OUTSIDE the
  // parent's layout rect, so marking the parent dirty alone won't clear it.
  // Drain the pending list and erase those screen areas now.
  // ── Pass 0: Clear areas of removed/resized absolute overlays ──
  if (!full && pendingStaleRects.length > 0) {
    for (const rect of pendingStaleRects) {
      for (let row = rect.y; row < rect.y + rect.height; row++) {
        if (row < 0 || row >= fb.height) continue;
        for (let col = rect.x; col < rect.x + rect.width; col++) {
          if (col < 0 || col >= fb.width) continue;
          fb.setChar(col, row, " ");
          preClearCells++;
        }
      }
    }
    // Overlap marking is handled inside collectPaintEntries (via the
    // staleRects parameter) so that ancestorDirty propagates correctly
    // through clip containers and their descendants.
    pendingStaleRects.length = 0;
  }

  // ── Pass 1: Pre-clear stale pixels ──
  if (!full) {
    for (const entry of entries) {
      if (!entry.dirty) continue;
      const node = entry.node;
      if (!node._paintDirty) continue;

      const inherited = getInheritedTextStyle(node);

      const prev = node._prevLayout;
      if (prev) {
        // Case 1: Node MOVED/RESIZED — clear the OLD rect so ghost pixels vanish.
        // For absolute-positioned nodes, Pass 0 already cleared the stale area
        // via pendingStaleRects (with bg=undefined).  Re-clearing here would
        // overwrite those cells with inherited.bg — which is the OVERLAY's
        // ancestor bg (e.g. gray), not the content that was underneath.
        // Skip for absolute nodes to avoid re-painting wrong colors.
        if (prev.width > 0 && prev.height > 0 &&
            node.resolvedStyle.position !== "absolute") {
          for (let row = prev.y; row < prev.y + prev.height; row++) {
            for (let col = prev.x; col < prev.x + prev.width; col++) {
              if (isInClip(col, row, entry.clip)) {
                fb.setChar(col, row, " ", undefined, inherited.bg);
                preClearCells++;
              }
            }
          }
        }
        // Consume _prevLayout in all cases (including zero-rect from newly
        // created nodes) so the NEXT frame sees null and can use Case 2
        // for content-only changes.
        node._prevLayout = null;
      }
      // Case 2: content changed but node didn't move — clear current area.
      // Only fires when _prevLayout is null, meaning the node was already
      // painted at this position on a prior frame.  New nodes arrive with
      // _prevLayout set to the default zero-rect (consumed above) — we must
      // NOT clear their area because it contains content from OTHER nodes
      // that won't be repainted (e.g. fullscreen JumpNav overlay would
      // wipe the entire screen).
      // Skip if node has its own bg since paintNode fills it anyway.
      else if (!node.resolvedStyle.bg) {
        const { x, y, width, height } = node.layout;
        for (let row = y; row < y + height; row++) {
          for (let col = x; col < x + width; col++) {
            if (isInClip(col, row, entry.clip)) {
              fb.setChar(col, row, " ", undefined, inherited.bg);
              preClearCells++;
            }
          }
        }
      }
    }
  }

  // ── Pass 2: Paint nodes ──
  for (const entry of entries) {
    const node = entry.node;

    // On incremental frames, skip nodes that aren't dirty
    // (dirty = node._paintDirty OR an ancestor was dirty)
    if (!full && !entry.dirty) continue;
    dirtyCount++;

    const nodeResult = paintNode(node, fb, entry.clip, options, getInheritedTextStyle(node));
    node._paintDirty = false;

    // Capture cursor position from the focused input
    if (nodeResult?.cursorPosition) {
      result.cursorPosition = nodeResult.cursorPosition;
    }
  }

  // If the focused input wasn't dirty (skipped above), we still need its
  // cursor position so the terminal cursor stays visible.  Compute it from
  // the node's existing layout without repainting.
  if (!result.cursorPosition && options.cursorInfo && options.useNativeCursor) {
    const { nodeId, position } = options.cursorInfo;
    for (const entry of entries) {
      const node = entry.node;
      if (node.type === "input" && node.focusId === nodeId) {
        const { innerX, innerY, innerWidth } = node.layout;
        if (innerWidth > 0) {
          const cursorCol = Math.min(position, innerWidth - 1);
          const cursorX = innerX + cursorCol;
          if (isInClip(cursorX, innerY, entry.clip)) {
            result.cursorPosition = { x: cursorX, y: innerY, bg: getInheritedTextStyle(node).bg };
          }
        }
        break;
      }
    }
  }

  perf.paintLoop = performance.now() - tPaint0;
  perf.dirtyEntries = dirtyCount;
  perf.preClearCells = preClearCells;

  return result;
}

/** Walk a subtree and return true as soon as any node has _paintDirty set. */
function hasAnyDirtyDescendant(node: GlyphNode): boolean {
  for (const child of node.children) {
    if (child._paintDirty || hasAnyDirtyDescendant(child)) return true;
  }
  return false;
}

function collectPaintEntries(
  node: GlyphNode,
  parentClip: ClipRect,
  parentZ: number,
  entries: PaintEntry[],
  ancestorDirty: boolean,
  staleRects?: Array<{ x: number; y: number; width: number; height: number }> | null,
): void {
  if (node.hidden) return;

  // Early-out: skip nodes (and all their descendants) that are entirely
  // outside the clip rect.  This avoids iterating hundreds of off-screen
  // ScrollView children that would result in no-op writes.
  const { x, y, width, height } = node.layout;
  if (
    width > 0 && height > 0 &&
    parentClip.width > 0 && parentClip.height > 0 &&
    (x >= parentClip.x + parentClip.width ||
     x + width <= parentClip.x ||
     y >= parentClip.y + parentClip.height ||
     y + height <= parentClip.y)
  ) {
    return;
  }

  const zIndex = node.resolvedStyle.zIndex ?? parentZ;
  // A node is "dirty" if it or any ancestor is dirty
  let dirty = node._paintDirty || ancestorDirty;

  // If the node overlaps a stale rect (from a removed or resized absolute
  // overlay), treat it as dirty so it gets repainted.  Checking here
  // (instead of post-hoc on the entries array) ensures ancestorDirty
  // propagates correctly to descendants — critical for clip containers
  // whose viewport fill wipes everything.
  if (!dirty && staleRects) {
    for (const rect of staleRects) {
      if (
        x < rect.x + rect.width &&
        x + width > rect.x &&
        y < rect.y + rect.height &&
        y + height > rect.y
      ) {
        dirty = true;
        break;
      }
    }
  }

  // Clip containers (e.g. ScrollView) must repaint their viewport fill
  // whenever ANY descendant changes — the clip fill wipes the entire
  // viewport, so all children need repainting via ancestorDirty.
  // Check the full subtree, not just direct children, because dirty
  // text nodes can be deeply nested (e.g. Text inside Box inside ScrollView).
  if (!dirty && node.resolvedStyle.clip) {
    dirty = hasAnyDirtyDescendant(node);
  }

  // Clip rect for THIS node's own painting (bg, border, text).
  // Uses parentClip so the node can paint within its parent's bounds.
  entries.push({ node, clip: parentClip, zIndex, dirty });

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
      collectPaintEntries(child, childClip, zIndex, entries, dirty, staleRects);
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

type InheritedStyle = ReturnType<typeof getInheritedTextStyle>;

function paintNode(
  node: GlyphNode,
  fb: Framebuffer,
  clip: ClipRect,
  options: PaintOptions = {},
  inherited: InheritedStyle = getInheritedTextStyle(node),
): PaintResult | undefined {
  const { x, y, width, height, innerX, innerY, innerWidth, innerHeight } = node.layout;
  const style = node.resolvedStyle;

  if (width <= 0 || height <= 0) return;

  // Resolve inherited bg so borders and fills don't erase a parent's background
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
    paintText(node, fb, clip, inherited);
  } else if (node.type === "input") {
    return paintInput(node, fb, clip, options, inherited);
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

// ── Text rasterization cache ────────────────────────────────────
// Caches the result of collectStyledSegments → parseAnsi → wrap → style
// merge so that text nodes painted only because an ancestor is dirty
// (content unchanged) can skip all text processing and replay the
// cached characters directly.

interface CachedChar {
  char: string;
  charWidth: number;
  fg: Color | undefined;
  bg: Color | undefined;
  bold: boolean | undefined;
  dim: boolean | undefined;
  italic: boolean | undefined;
  underline: boolean | undefined;
}

interface CachedTextLine {
  chars: CachedChar[];
  visibleWidth: number;
}

interface TextRasterCache {
  // ── Cache key ──
  text: string | null;
  innerWidth: number;
  styleRef: ResolvedStyle;
  iColor: Color | undefined;
  iBg: Color | undefined;
  iBold: boolean | undefined;
  iDim: boolean | undefined;
  iItalic: boolean | undefined;
  iUnderline: boolean | undefined;
  // ── Cached result ──
  lines: CachedTextLine[];
  textAlign: string;
}

function textCacheValid(
  cache: TextRasterCache,
  text: string | null,
  innerWidth: number,
  styleRef: ResolvedStyle,
  inherited: ReturnType<typeof getInheritedTextStyle>,
): boolean {
  return (
    cache.text === text &&
    cache.innerWidth === innerWidth &&
    cache.styleRef === styleRef &&
    cache.iColor === inherited.color &&
    cache.iBg === inherited.bg &&
    cache.iBold === inherited.bold &&
    cache.iDim === inherited.dim &&
    cache.iItalic === inherited.italic &&
    cache.iUnderline === inherited.underline
  );
}

function paintFromCache(
  cache: TextRasterCache,
  node: GlyphNode,
  fb: Framebuffer,
  clip: ClipRect,
): void {
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;
  const textAlign = cache.textAlign;

  for (let lineIdx = 0; lineIdx < cache.lines.length && lineIdx < innerHeight; lineIdx++) {
    const line = cache.lines[lineIdx]!;
    let offsetX = 0;
    if (textAlign === "center") {
      offsetX = Math.max(0, Math.floor((innerWidth - line.visibleWidth) / 2));
    } else if (textAlign === "right") {
      offsetX = Math.max(0, innerWidth - line.visibleWidth);
    }

    let col = 0;
    for (const cc of line.chars) {
      if (cc.charWidth > 0) {
        setClipped(
          fb, clip,
          innerX + offsetX + col, innerY + lineIdx,
          cc.char,
          cc.fg, cc.bg, cc.bold, cc.dim, cc.italic, cc.underline,
        );
      }
      col += cc.charWidth;
    }
  }
}

function paintText(node: GlyphNode, fb: Framebuffer, clip: ClipRect, inherited: InheritedStyle): void {
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;

  // ── Cache check ──
  // Skip cache for nodes with GlyphNode children (nested Text) — their
  // styling depends on children's resolved styles which aren't tracked here.
  const hasNestedTextNodes = node.children.length > 0;
  if (!hasNestedTextNodes) {
    const cache = node._textCache as TextRasterCache | null;
    if (cache && textCacheValid(cache, node.text, innerWidth, node.resolvedStyle, inherited)) {
      perf.textCacheHits++;
      paintFromCache(cache, node, fb, clip);
      return;
    }
    perf.textCacheMisses++;
  }

  // ── Full rasterization ──
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
  const rawLines: StyledChar[][] = [];
  let lineStart = 0;
  for (const breakIdx of lineBreaks) {
    rawLines.push(styledChars.slice(lineStart, breakIdx));
    lineStart = breakIdx;
  }
  rawLines.push(styledChars.slice(lineStart)); // Last line (or only line if no breaks)
  
  // Wrap each line and track styled chars
  const wrappedLines: StyledChar[][] = [];
  
  for (const line of rawLines) {
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

  // ── Build cache + paint in one pass ──
  const cachedLines: CachedTextLine[] = [];

  for (let lineIdx = 0; lineIdx < wrappedLines.length && lineIdx < innerHeight; lineIdx++) {
    const line = wrappedLines[lineIdx]!;
    const cachedChars: CachedChar[] = [];
    let visibleWidth = 0;

    for (const { char, style } of line) {
      const charWidth = ttyCharWidth(char);
      const fg = autoContrastFg(style.color, style.bg);
      cachedChars.push({
        char, charWidth,
        fg, bg: style.bg,
        bold: style.bold, dim: style.dim,
        italic: style.italic, underline: style.underline,
      });
      visibleWidth += charWidth;
    }

    cachedLines.push({ chars: cachedChars, visibleWidth });

    // Paint this line
    let offsetX = 0;
    if (textAlign === "center") {
      offsetX = Math.max(0, Math.floor((innerWidth - visibleWidth) / 2));
    } else if (textAlign === "right") {
      offsetX = Math.max(0, innerWidth - visibleWidth);
    }

    let col = 0;
    for (const cc of cachedChars) {
      if (cc.charWidth > 0) {
        setClipped(
          fb, clip,
          innerX + offsetX + col, innerY + lineIdx,
          cc.char,
          cc.fg, cc.bg, cc.bold, cc.dim, cc.italic, cc.underline,
        );
      }
      col += cc.charWidth;
    }
  }

  // Store cache (only for simple text nodes without nested children)
  if (!hasNestedTextNodes) {
    node._textCache = {
      text: node.text,
      innerWidth,
      styleRef: node.resolvedStyle,
      iColor: inherited.color,
      iBg: inherited.bg,
      iBold: inherited.bold,
      iDim: inherited.dim,
      iItalic: inherited.italic,
      iUnderline: inherited.underline,
      lines: cachedLines,
      textAlign,
    } satisfies TextRasterCache;
  }
}

function paintInput(
  node: GlyphNode,
  fb: Framebuffer,
  clip: ClipRect,
  options: PaintOptions = {},
  inherited: InheritedStyle = getInheritedTextStyle(node),
): PaintResult | undefined {
  const { cursorInfo, useNativeCursor } = options;
  const { innerX, innerY, innerWidth, innerHeight } = node.layout;
  if (innerWidth <= 0 || innerHeight <= 0) return;

  const value: string = node.props.value ?? node.props.defaultValue ?? "";
  const placeholder: string = node.props.placeholder ?? "";
  const displayText = value || placeholder;
  const isPlaceholder = !value && !!placeholder;
  const multiline: boolean = node.props.multiline ?? false;

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
