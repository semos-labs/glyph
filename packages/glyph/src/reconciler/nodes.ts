import Yoga from "yoga-layout";
import type { Node as YogaNode } from "yoga-layout";
import type { Style, ResolvedStyle, LayoutRect, Color } from "../types/index.js";

/**
 * Shared Yoga configuration with pixel-grid rounding disabled.
 *
 * Yoga's built-in rounding (`pointScaleFactor = 1`) rounds each node's
 * `left` and `width` independently which can create 1-pixel gaps or
 * overlaps between siblings whose positions fall on fractional boundaries.
 *
 * By setting `pointScaleFactor = 0` we receive raw float positions and
 * apply our own edge-based rounding in {@link extractLayout} (in
 * `yogaLayout.ts`), which guarantees adjacent siblings share the same
 * rounded edge — zero gaps, zero overlaps.
 *
 * @internal
 */
export const yogaConfig = Yoga.Config.create();
yogaConfig.setPointScaleFactor(0);

export type GlyphNodeType = "box" | "text" | "input";

/**
 * Layout rects of recently-removed nodes whose screen area must be cleared
 * on the next paint frame.  `removeChild` pushes to this list; `paintTree`
 * drains it during the pre-clear pass.
 */
export const pendingStaleRects: Array<{ x: number; y: number; width: number; height: number }> = [];

export type GlyphChild = GlyphNode | GlyphTextInstance;

export interface GlyphNode {
  type: GlyphNodeType;
  props: Record<string, any>;
  style: Style;
  /** Style with all responsive values resolved for the current terminal size. Populated by the layout system before each frame. */
  resolvedStyle: ResolvedStyle;
  children: GlyphNode[];
  rawTextChildren: GlyphTextInstance[];
  /** All children in order (both nodes and raw text) for correct text composition */
  allChildren: GlyphChild[];
  parent: GlyphNode | null;
  yogaNode: YogaNode | null;
  text: string | null;
  layout: LayoutRect;
  focusId: string | null;
  hidden: boolean;
  /** @internal Cache: terminal columns when resolvedStyle was last computed. */
  _lastColumns: number;
  /** @internal Cache: style object reference when resolvedStyle was last computed. */
  _lastStyleRef: Style | null;
  /** @internal Cache: resolvedStyle reference when Yoga styles were last applied. */
  _lastYogaStyle: ResolvedStyle | null;
  /** @internal Whether a Yoga measure function has been installed on this node. */
  _hasMeasureFunc: boolean;
  /** @internal Whether this node's visual content changed since the last paint. */
  _paintDirty: boolean;
  /** @internal Previous layout rect — set when layout changes so the painter can clear the OLD position. */
  _prevLayout: LayoutRect | null;
  /** @internal Cached Yoga relative left offset (avoids WASM reads when parent moved). */
  _relLeft: number;
  /** @internal Cached Yoga relative top offset (avoids WASM reads when parent moved). */
  _relTop: number;
  /** @internal Raw (unrounded) absolute X from Yoga. Used to propagate sub-pixel precision to children. */
  _rawAbsX: number;
  /** @internal Raw (unrounded) absolute Y from Yoga. Used to propagate sub-pixel precision to children. */
  _rawAbsY: number;
  /** @internal Cached text rasterization result (managed by painter.ts). */
  _textCache: any;
}

export interface GlyphTextInstance {
  type: "raw-text";
  text: string;
  parent: GlyphNode | null;
}

export interface GlyphContainer {
  type: "root";
  children: GlyphNode[];
  onCommit: () => void;
  yogaNode?: YogaNode;
}

// ── Shared empty style (avoids creating new {} on every commitUpdate) ──
export const EMPTY_STYLE: Style = Object.freeze({}) as Style;

/**
 * Fast shallow equality for Style objects.  Compares own keys with `===`.
 * Returns `true` when every property is reference-identical — covers all
 * primitives (strings, numbers, booleans) and same-reference objects.
 */
export function shallowStyleEqual(a: Style, b: Style): boolean {
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const k = aKeys[i]!;
    if (aRec[k] !== bRec[k]) return false;
  }
  return true;
}

// ── Layout dirty tracking ───────────────────────────────────────
// Tracks whether Yoga calculateLayout needs to run.
let _layoutDirty = true;
export function markLayoutDirty(): void { _layoutDirty = true; }
export function isLayoutDirty(): boolean { return _layoutDirty; }
export function resetLayoutDirty(): void { _layoutDirty = false; }

/**
 * Walk a subtree and push every non-zero layout rect into
 * {@link pendingStaleRects} so the painter can clear those screen areas.
 */
export function collectStaleRects(node: GlyphNode): void {
  const { x, y, width, height } = node.layout;
  if (width > 0 && height > 0) {
    pendingStaleRects.push({ x, y, width, height });
  }
  for (const child of node.children) {
    collectStaleRects(child);
  }
}


let nextFocusId = 0;
export function generateFocusId(): string {
  return `glyph-focus-${nextFocusId++}`;
}

export function createGlyphNode(
  type: GlyphNodeType,
  props: Record<string, any>,
): GlyphNode {
  const style = (props.style as Style) ?? {};
  return {
    type,
    props,
    style,
    resolvedStyle: {} as ResolvedStyle,
    children: [],
    rawTextChildren: [],
    allChildren: [],
    parent: null,
    yogaNode: Yoga.Node.createWithConfig(yogaConfig),
    text: null,
    layout: { x: 0, y: 0, width: 0, height: 0, innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0 },
    focusId: type === "input" ? generateFocusId() : (props.focusable ? generateFocusId() : null),
    hidden: false,
    _lastColumns: -1,
    _lastStyleRef: null,
    _lastYogaStyle: null,
    _hasMeasureFunc: false,
    _paintDirty: true,
    _prevLayout: null,
    _relLeft: 0,
    _relTop: 0,
    _rawAbsX: 0,
    _rawAbsY: 0,
    _textCache: null,
  };
}

export function appendChild(parent: GlyphNode, child: GlyphNode): void {
  // Remove from old position if already a child (React reorders via appendChild)
  const existingIdx = parent.children.indexOf(child);
  if (existingIdx !== -1) parent.children.splice(existingIdx, 1);
  const existingAllIdx = parent.allChildren.indexOf(child);
  if (existingAllIdx !== -1) parent.allChildren.splice(existingAllIdx, 1);

  child.parent = parent;
  parent.children.push(child);
  parent.allChildren.push(child);

  yogaAppendChild(parent, child);
  markLayoutDirty();
  // NOTE: we intentionally do NOT set parent._paintDirty here.
  // The parent's own visual content (bg, border) hasn't changed — only
  // its children list.  If the new child causes layout shifts,
  // extractLayout will set _paintDirty + _prevLayout on each affected
  // node.  Eagerly dirtying the parent triggers a destructive pre-clear
  // of its entire area (Pass 1 Case 2), which wipes content underneath
  // overlays like JumpNav whose absolute-positioned children don't
  // affect the parent's layout at all.
}

export function appendTextChild(parent: GlyphNode, child: GlyphTextInstance): void {
  // Remove from old position if already a child (React reorders via appendChild)
  const existingRawIdx = parent.rawTextChildren.indexOf(child);
  if (existingRawIdx !== -1) parent.rawTextChildren.splice(existingRawIdx, 1);
  const existingAllIdx = parent.allChildren.indexOf(child);
  if (existingAllIdx !== -1) parent.allChildren.splice(existingAllIdx, 1);

  child.parent = parent;
  parent.rawTextChildren.push(child);
  parent.allChildren.push(child);
  parent.text = parent.rawTextChildren.map((t) => t.text).join("");
}

export function removeChild(parent: GlyphNode, child: GlyphNode): void {
  // Save the removed subtree's screen area so the painter can clear it.
  // This is critical for absolute-positioned children (e.g. Select
  // dropdowns) whose area falls OUTSIDE the parent's layout rect —
  // marking the parent dirty alone won't clear the removed overlay.
  collectStaleRects(child);

  // Detach child's Yoga node from this parent's Yoga tree.
  yogaRemoveChild(parent, child);

  // Free the *entire* Yoga subtree synchronously.
  //
  // React only calls hostConfig.removeChild for permanent deletions
  // (not moves/reorders — those go through appendChild/insertBefore
  // which handle repositioning internally).  Freeing now prevents
  // zombie WASM objects from lingering until React's passive-effects
  // phase fires detachDeletedInstance.
  //
  // NOTE: freeYogaSubtree must be called BEFORE we splice `child` out
  // of parent.children, because it walks child.children recursively.
  freeYogaSubtree(child);

  markLayoutDirty();
  // Don't set parent._paintDirty — pendingStaleRects handles the removed
  // area, and extractLayout handles any layout shifts of remaining siblings.

  const idx = parent.children.indexOf(child);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
    child.parent = null;
  }
  const allIdx = parent.allChildren.indexOf(child);
  if (allIdx !== -1) {
    parent.allChildren.splice(allIdx, 1);
  }
}

export function removeTextChild(parent: GlyphNode, child: GlyphTextInstance): void {
  child.parent = null;
  const idx = parent.rawTextChildren.indexOf(child);
  if (idx !== -1) parent.rawTextChildren.splice(idx, 1);
  const allIdx = parent.allChildren.indexOf(child);
  if (allIdx !== -1) parent.allChildren.splice(allIdx, 1);
  parent.text = parent.rawTextChildren.map((t) => t.text).join("") || null;
}

export function insertBefore(
  parent: GlyphNode,
  child: GlyphNode,
  beforeChild: GlyphNode,
): void {
  // Remove from old position if already a child (React reorders via insertBefore)
  const existingIdx = parent.children.indexOf(child);
  if (existingIdx !== -1) parent.children.splice(existingIdx, 1);
  const existingAllIdx = parent.allChildren.indexOf(child);
  if (existingAllIdx !== -1) parent.allChildren.splice(existingAllIdx, 1);

  child.parent = parent;
  const idx = parent.children.indexOf(beforeChild);
  if (idx !== -1) {
    parent.children.splice(idx, 0, child);
  } else {
    parent.children.push(child);
  }
  // Also maintain allChildren order
  const allIdx = parent.allChildren.indexOf(beforeChild);
  if (allIdx !== -1) {
    parent.allChildren.splice(allIdx, 0, child);
  } else {
    parent.allChildren.push(child);
  }

  yogaInsertBefore(parent, child, beforeChild);
  markLayoutDirty();
  // Same rationale as appendChild — don't eagerly dirty the parent.
  // extractLayout handles any layout shifts from the insertion.
}

export function insertTextBefore(
  parent: GlyphNode,
  child: GlyphTextInstance,
  beforeChild: GlyphChild,
): void {
  // Remove from old position if already a child (React reorders via insertBefore)
  const existingRawIdx = parent.rawTextChildren.indexOf(child);
  if (existingRawIdx !== -1) parent.rawTextChildren.splice(existingRawIdx, 1);
  const existingAllIdx = parent.allChildren.indexOf(child);
  if (existingAllIdx !== -1) parent.allChildren.splice(existingAllIdx, 1);

  child.parent = parent;
  parent.rawTextChildren.push(child);
  const allIdx = parent.allChildren.indexOf(beforeChild);
  if (allIdx !== -1) {
    parent.allChildren.splice(allIdx, 0, child);
  } else {
    parent.allChildren.push(child);
  }
  parent.text = parent.rawTextChildren.map((t) => t.text).join("");
}

// ── Yoga tree helpers ───────────────────────────────────────────
// These mirror GlyphNode tree ops so the Yoga tree stays in sync
// with the GlyphNode tree at all times.  Text/input nodes are Yoga
// leaves (they have a measure function) so their children are never
// added to the Yoga tree.

/** Detach a Yoga node from its Yoga parent (if any). */
function yogaDetach(node: GlyphNode): void {
  if (!node.yogaNode) return;
  const parent = node.yogaNode.getParent();
  if (parent) parent.removeChild(node.yogaNode);
}

/** Append child's Yoga node to parent's Yoga node. */
export function yogaAppendChild(parent: GlyphNode, child: GlyphNode): void {
  if (!parent.yogaNode || !child.yogaNode) return;
  if (parent.type === "text" || parent.type === "input") return;
  yogaDetach(child);
  parent.yogaNode.insertChild(child.yogaNode, parent.yogaNode.getChildCount());
}

/** Remove child's Yoga node from parent's Yoga node. */
export function yogaRemoveChild(parent: GlyphNode, child: GlyphNode): void {
  if (!parent.yogaNode || !child.yogaNode) return;
  if (parent.type === "text" || parent.type === "input") return;
  const currentParent = child.yogaNode.getParent();
  if (currentParent) currentParent.removeChild(child.yogaNode);
}

/** Insert child's Yoga node before beforeChild's Yoga node in parent. */
export function yogaInsertBefore(
  parent: GlyphNode,
  child: GlyphNode,
  beforeChild: GlyphNode,
): void {
  if (!parent.yogaNode || !child.yogaNode || !beforeChild.yogaNode) return;
  if (parent.type === "text" || parent.type === "input") return;
  yogaDetach(child);

  // NOTE: We cannot use `parent.yogaNode.getChild(i) === beforeChild.yogaNode`
  // because yoga-layout's WASM bindings return a *new* JS wrapper object on
  // every getChild() call, so `===` always fails.  Instead, derive the
  // correct Yoga index from the GlyphNode children array — which has already
  // been updated to the correct order by the caller (insertBefore in nodes.ts).
  let idx = 0;
  for (const sibling of parent.children) {
    if (sibling === child) break; // child's position = the target index
    if (sibling.yogaNode) idx++;
  }
  parent.yogaNode.insertChild(child.yogaNode, idx);
}

/**
 * Free a single GlyphNode's Yoga node.
 *
 * Detaches from its Yoga parent, unsets any measure function, removes
 * remaining Yoga children, then frees the WASM object.
 *
 * Safe to call when `yogaNode` is already `null` (no-op).
 */
export function freeYogaNode(node: GlyphNode): void {
  if (!node.yogaNode) return;

  yogaDetach(node);

  // Unset measure function before freeing to release the JS closure
  // reference in the WASM callback table.
  if (node._hasMeasureFunc) {
    node.yogaNode.unsetMeasureFunc();
    node._hasMeasureFunc = false;
  }

  // Detach any remaining Yoga children so they don't hold a stale parent.
  const yn = node.yogaNode;
  while (yn.getChildCount() > 0) {
    yn.removeChild(yn.getChild(0));
  }

  yn.free();
  node.yogaNode = null;
}

/**
 * Recursively free a GlyphNode subtree's Yoga nodes (bottom-up).
 *
 * React's `removeChild` is only called for *permanent* deletions (not
 * moves/reorders).  By freeing the entire Yoga subtree synchronously
 * during the mutation commit we avoid zombie WASM objects that linger
 * between the mutation phase and React's passive-effects phase (where
 * `detachDeletedInstance` would normally call `freeYogaNode`).
 *
 * When `detachDeletedInstance` fires later it finds `yogaNode === null`
 * and harmlessly no-ops.
 */
export function freeYogaSubtree(node: GlyphNode): void {
  // Free children first (bottom-up) so each child can safely
  // detach itself from its Yoga parent while that parent is still alive.
  for (const child of node.children) {
    freeYogaSubtree(child);
  }
  freeYogaNode(node);
}

export function getInheritedTextStyle(node: GlyphNode): {
  color?: Color;
  bg?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
} {
  const result: {
    color?: Color;
    bg?: Color;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
  } = {};

  let current: GlyphNode | null = node;
  while (current) {
    const s = current.resolvedStyle;
    if (result.color === undefined && s.color !== undefined) result.color = s.color;
    if (result.bg === undefined && s.bg !== undefined) result.bg = s.bg;
    if (result.bold === undefined && s.bold !== undefined) result.bold = s.bold;
    if (result.dim === undefined && s.dim !== undefined) result.dim = s.dim;
    if (result.italic === undefined && s.italic !== undefined) result.italic = s.italic;
    if (result.underline === undefined && s.underline !== undefined) result.underline = s.underline;
    current = current.parent;
  }

  return result;
}

export function collectTextContent(node: GlyphNode): string {
  if (node.text != null && node.allChildren.length === 0) return node.text;
  let result = "";
  for (const child of node.allChildren) {
    if (child.type === "raw-text") {
      result += child.text;
    } else {
      result += collectTextContent(child);
    }
  }
  // Fallback for nodes without allChildren populated
  if (!result && node.text != null) return node.text;
  return result;
}

/** Text style properties for styled segments */
export interface TextStyleProps {
  color?: Color;
  bg?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** A segment of text with its accumulated style from nested Text components */
export interface TextSegment {
  text: string;
  style: TextStyleProps;
}

/** Collect text segments with their styles for proper nested text rendering */
export function collectStyledSegments(
  node: GlyphNode,
  inheritedStyle: TextStyleProps = {},
): TextSegment[] {
  const segments: TextSegment[] = [];
  
  // Merge current node's resolved style with inherited
  const currentStyle: TextStyleProps = {
    color: node.resolvedStyle.color ?? inheritedStyle.color,
    bg: node.resolvedStyle.bg ?? inheritedStyle.bg,
    bold: node.resolvedStyle.bold ?? inheritedStyle.bold,
    dim: node.resolvedStyle.dim ?? inheritedStyle.dim,
    italic: node.resolvedStyle.italic ?? inheritedStyle.italic,
    underline: node.resolvedStyle.underline ?? inheritedStyle.underline,
  };
  
  // If no allChildren, use text directly
  if (node.allChildren.length === 0 && node.text != null) {
    segments.push({ text: node.text, style: currentStyle });
    return segments;
  }
  
  // Traverse children in order
  for (const child of node.allChildren) {
    if (child.type === "raw-text") {
      segments.push({ text: child.text, style: currentStyle });
    } else {
      // Recurse into child node with current style as inherited
      segments.push(...collectStyledSegments(child, currentStyle));
    }
  }
  
  return segments;
}
