import Yoga from "yoga-layout";
import type { Node as YogaNode } from "yoga-layout";
import type { Style, ResolvedStyle, LayoutRect, Color } from "../types/index.js";

export type GlyphNodeType = "box" | "text" | "input";

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

// ── Layout dirty tracking ───────────────────────────────────────
// Tracks whether Yoga calculateLayout needs to run.
let _layoutDirty = true;
export function markLayoutDirty(): void { _layoutDirty = true; }
export function isLayoutDirty(): boolean { return _layoutDirty; }
export function resetLayoutDirty(): void { _layoutDirty = false; }

// ── Structural change tracking ──────────────────────────────────
// Structural changes (add/remove/move nodes) require full repaint.
let _structuralChange = false;
export function markStructuralChange(): void { _structuralChange = true; }
export function consumeStructuralChange(): boolean {
  const v = _structuralChange;
  _structuralChange = false;
  return v;
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
    yogaNode: Yoga.Node.create(),
    text: null,
    layout: { x: 0, y: 0, width: 0, height: 0, innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0 },
    focusId: type === "input" ? generateFocusId() : (props.focusable ? generateFocusId() : null),
    hidden: false,
    _lastColumns: -1,
    _lastStyleRef: null,
    _lastYogaStyle: null,
    _hasMeasureFunc: false,
    _paintDirty: true,
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
  markStructuralChange();
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
  yogaRemoveChild(parent, child);
  markLayoutDirty();
  markStructuralChange();

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
  markStructuralChange();
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
  const count = parent.yogaNode.getChildCount();
  let idx = count;
  for (let i = 0; i < count; i++) {
    if (parent.yogaNode.getChild(i) === beforeChild.yogaNode) {
      idx = i;
      break;
    }
  }
  parent.yogaNode.insertChild(child.yogaNode, idx);
}

/**
 * Free a GlyphNode's Yoga node when it is permanently deleted.
 *
 * React calls `detachDeletedInstance` top-down (parent before children).
 * We detach all Yoga children first so their `getParent()` returns null
 * when they are later freed — avoids a use-after-free on Yoga's WASM heap.
 */
export function freeYogaNode(node: GlyphNode): void {
  if (!node.yogaNode) return;

  yogaDetach(node);

  // Detach Yoga children before freeing this node
  const yn = node.yogaNode;
  while (yn.getChildCount() > 0) {
    yn.removeChild(yn.getChild(0));
  }

  yn.free();
  node.yogaNode = null;
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
