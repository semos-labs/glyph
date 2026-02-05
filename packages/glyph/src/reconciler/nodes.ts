import type { Node as YogaNode } from "yoga-layout";
import type { Style, LayoutRect, Color } from "../types/index.js";

export type GlyphNodeType = "box" | "text" | "input";

export interface GlyphNode {
  type: GlyphNodeType;
  props: Record<string, any>;
  style: Style;
  children: GlyphNode[];
  rawTextChildren: GlyphTextInstance[];
  parent: GlyphNode | null;
  yogaNode: YogaNode | null;
  text: string | null;
  layout: LayoutRect;
  focusId: string | null;
  hidden: boolean;
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
    children: [],
    rawTextChildren: [],
    parent: null,
    yogaNode: null,
    text: null,
    layout: { x: 0, y: 0, width: 0, height: 0, innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0 },
    focusId: type === "input" ? generateFocusId() : (props.focusable ? generateFocusId() : null),
    hidden: false,
  };
}

export function appendChild(parent: GlyphNode, child: GlyphNode): void {
  child.parent = parent;
  parent.children.push(child);
}

export function removeChild(parent: GlyphNode, child: GlyphNode): void {
  const idx = parent.children.indexOf(child);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
    child.parent = null;
  }
}

export function insertBefore(
  parent: GlyphNode,
  child: GlyphNode,
  beforeChild: GlyphNode,
): void {
  child.parent = parent;
  const idx = parent.children.indexOf(beforeChild);
  if (idx !== -1) {
    parent.children.splice(idx, 0, child);
  } else {
    parent.children.push(child);
  }
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
    const s = current.style;
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
  if (node.text != null) return node.text;
  let result = "";
  for (const child of node.children) {
    result += collectTextContent(child);
  }
  return result;
}
