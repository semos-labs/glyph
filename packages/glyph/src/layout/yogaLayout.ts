import Yoga, {
  Align,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  PositionType,
  Wrap,
  Direction,
  Overflow,
} from "yoga-layout";
import type { Node as YogaNode } from "yoga-layout";
import type { GlyphNode } from "../reconciler/nodes.js";
import { isLayoutDirty, resetLayoutDirty } from "../reconciler/nodes.js";
import type { ResolvedStyle, DimensionValue } from "../types/index.js";
import { measureText } from "./textMeasure.js";
import { resolveNodeStyles } from "./responsive.js";

const FLEX_DIR_MAP: Record<string, FlexDirection> = {
  row: FlexDirection.Row,
  column: FlexDirection.Column,
};

const JUSTIFY_MAP: Record<string, Justify> = {
  "flex-start": Justify.FlexStart,
  center: Justify.Center,
  "flex-end": Justify.FlexEnd,
  "space-between": Justify.SpaceBetween,
  "space-around": Justify.SpaceAround,
};

const ALIGN_MAP: Record<string, Align> = {
  "flex-start": Align.FlexStart,
  center: Align.Center,
  "flex-end": Align.FlexEnd,
  stretch: Align.Stretch,
};

// ── Style helpers ───────────────────────────────────────────────

function setDimension(
  node: YogaNode,
  setter: (v: number | `${number}%` | undefined) => void,
  value: DimensionValue | undefined,
): void {
  if (value === undefined) return;
  if (typeof value === "string" && value.endsWith("%")) {
    setter(value as `${number}%`);
  } else {
    setter(value as number);
  }
}

function setPosition(
  node: YogaNode,
  edge: Edge,
  value: DimensionValue | undefined,
): void {
  if (value === undefined) return;
  if (typeof value === "string" && value.endsWith("%")) {
    node.setPositionPercent(edge, parseFloat(value));
  } else {
    node.setPosition(edge, value as number);
  }
}

function applyStyleToYogaNode(yogaNode: YogaNode, style: ResolvedStyle, nodeType: string): void {
  // Dimensions
  setDimension(yogaNode, (v) => yogaNode.setWidth(v as any), style.width);
  setDimension(yogaNode, (v) => yogaNode.setHeight(v as any), style.height);

  if (style.minWidth !== undefined) yogaNode.setMinWidth(style.minWidth);
  if (style.minHeight !== undefined) yogaNode.setMinHeight(style.minHeight);
  if (style.maxWidth !== undefined) yogaNode.setMaxWidth(style.maxWidth);
  if (style.maxHeight !== undefined) yogaNode.setMaxHeight(style.maxHeight);

  // Padding
  if (style.padding !== undefined) yogaNode.setPadding(Edge.All, style.padding);
  if (style.paddingX !== undefined) yogaNode.setPadding(Edge.Horizontal, style.paddingX);
  if (style.paddingY !== undefined) yogaNode.setPadding(Edge.Vertical, style.paddingY);
  if (style.paddingTop !== undefined) yogaNode.setPadding(Edge.Top, style.paddingTop);
  if (style.paddingRight !== undefined) yogaNode.setPadding(Edge.Right, style.paddingRight);
  if (style.paddingBottom !== undefined) yogaNode.setPadding(Edge.Bottom, style.paddingBottom);
  if (style.paddingLeft !== undefined) yogaNode.setPadding(Edge.Left, style.paddingLeft);

  // Border thickness for layout (1 cell if border is set, 0 otherwise)
  const hasBorder = style.border != null && style.border !== "none";
  yogaNode.setBorder(Edge.All, hasBorder ? 1 : 0);

  // Flex
  if (style.flexDirection) {
    yogaNode.setFlexDirection(FLEX_DIR_MAP[style.flexDirection] ?? FlexDirection.Column);
  }
  if (style.flexWrap) {
    yogaNode.setFlexWrap(style.flexWrap === "wrap" ? Wrap.Wrap : Wrap.NoWrap);
  }
  if (style.justifyContent) {
    yogaNode.setJustifyContent(JUSTIFY_MAP[style.justifyContent] ?? Justify.FlexStart);
  }
  if (style.alignItems) {
    yogaNode.setAlignItems(ALIGN_MAP[style.alignItems] ?? Align.Stretch);
  }
  if (style.flexGrow !== undefined) yogaNode.setFlexGrow(style.flexGrow);
  if (style.flexShrink !== undefined) yogaNode.setFlexShrink(style.flexShrink);

  // Gap
  if (style.gap !== undefined) yogaNode.setGap(Gutter.All, style.gap);

  // Positioning
  if (style.position === "absolute") {
    yogaNode.setPositionType(PositionType.Absolute);
  } else {
    yogaNode.setPositionType(PositionType.Relative);
  }

  // Inset shorthand
  if (style.inset !== undefined) {
    setPosition(yogaNode, Edge.Top, style.inset);
    setPosition(yogaNode, Edge.Right, style.inset);
    setPosition(yogaNode, Edge.Bottom, style.inset);
    setPosition(yogaNode, Edge.Left, style.inset);
  }

  setPosition(yogaNode, Edge.Top, style.top);
  setPosition(yogaNode, Edge.Right, style.right);
  setPosition(yogaNode, Edge.Bottom, style.bottom);
  setPosition(yogaNode, Edge.Left, style.left);

  // Overflow / clip
  if (style.clip) {
    yogaNode.setOverflow(Overflow.Hidden);
  }
}

// ── Style sync ──────────────────────────────────────────────────
// The Yoga tree STRUCTURE is managed by the reconciler (appendChild,
// removeChild, insertBefore in nodes.ts + hostConfig.ts).  Each
// frame we only need to sync STYLES and install measure functions.

function collectAllText(node: GlyphNode): string {
  if (node.text != null) return node.text;
  let result = "";
  for (const child of node.children) {
    result += collectAllText(child);
  }
  if (result === "" && node.props.children != null) {
    if (typeof node.props.children === "string") return node.props.children;
    if (typeof node.props.children === "number") return String(node.props.children);
  }
  return result;
}

/**
 * Walk the tree and sync styles + measure functions.  No structural
 * changes — the reconciler keeps the Yoga tree in sync.
 */
function syncYogaStyles(nodes: GlyphNode[]): boolean {
  let anyChanged = false;
  for (const node of nodes) {
    if (node.hidden || !node.yogaNode) continue;

    // Apply styles only when resolvedStyle reference changed
    if (node.resolvedStyle !== node._lastYogaStyle) {
      applyStyleToYogaNode(node.yogaNode, node.resolvedStyle, node.type);
      node._lastYogaStyle = node.resolvedStyle;
      anyChanged = true;
    }

    // Install measure function once for text/input leaf nodes
    if (!node._hasMeasureFunc && (node.type === "text" || node.type === "input")) {
      node.yogaNode.setMeasureFunc((width, widthMode, _height, _heightMode) => {
        let text: string;
        if (node.type === "input") {
          text = node.props.value ?? node.props.defaultValue ?? node.props.placeholder ?? "";
          if (text.length === 0) text = " ";
        } else {
          text = collectAllText(node);
        }
        return measureText(
          text,
          width,
          widthMode,
          node.resolvedStyle.wrap ?? "wrap",
        );
      });
      node._hasMeasureFunc = true;
      anyChanged = true;
    }

    // Recurse into children
    if (node.type !== "text" && node.type !== "input") {
      if (syncYogaStyles(node.children)) anyChanged = true;
    }
  }
  return anyChanged;
}

function extractLayout(node: GlyphNode, parentX: number, parentY: number): void {
  const yn = node.yogaNode!;
  const computedLayout = yn.getComputedLayout();

  const x = parentX + computedLayout.left;
  const y = parentY + computedLayout.top;
  const width = computedLayout.width;
  const height = computedLayout.height;

  const borderWidth = node.resolvedStyle.border && node.resolvedStyle.border !== "none" ? 1 : 0;
  const paddingTop = yn.getComputedPadding(Edge.Top);
  const paddingRight = yn.getComputedPadding(Edge.Right);
  const paddingBottom = yn.getComputedPadding(Edge.Bottom);
  const paddingLeft = yn.getComputedPadding(Edge.Left);

  const innerX = x + borderWidth + paddingLeft;
  const innerY = y + borderWidth + paddingTop;
  const innerWidth = Math.max(0, width - borderWidth * 2 - paddingLeft - paddingRight);
  const innerHeight = Math.max(0, height - borderWidth * 2 - paddingTop - paddingBottom);

  // Only create new layout object if values actually changed (prevents infinite re-renders)
  const prev = node.layout;
  if (!prev ||
      prev.x !== x || prev.y !== y ||
      prev.width !== width || prev.height !== height ||
      prev.innerX !== innerX || prev.innerY !== innerY ||
      prev.innerWidth !== innerWidth || prev.innerHeight !== innerHeight) {
    node.layout = { x, y, width, height, innerX, innerY, innerWidth, innerHeight };
  }

  for (const child of node.children) {
    if (child.hidden || !child.yogaNode) continue;
    extractLayout(child, x, y);
  }
}

// ── Public API ──────────────────────────────────────────────────

/** Create the persistent root Yoga node for the terminal screen. */
export function createRootYogaNode(): YogaNode {
  const node = Yoga.Node.create();
  node.setFlexDirection(FlexDirection.Column);
  return node;
}

/**
 * Compute layout for the entire tree using persistent Yoga nodes.
 *
 * @param roots - Top-level GlyphNodes.
 * @param screenWidth - Terminal width in columns.
 * @param screenHeight - Terminal height in rows.
 * @param rootYoga - Persistent root Yoga node (screen container).
 * @param force - Force recalculation (e.g. on resize).
 * @returns `true` if Yoga `calculateLayout` actually ran.
 */
export function computeLayout(
  roots: GlyphNode[],
  screenWidth: number,
  screenHeight: number,
  rootYoga: YogaNode,
  force = false,
): boolean {
  // Fast path: nothing could have changed — skip all tree walks.
  // Safe because:
  //  • resize / init  → force = true
  //  • style change   → markLayoutDirty() from commitUpdate
  //  • text measure   → markLayoutDirty() from commitTextUpdate
  //  • structural     → force = true (via fullRepaint)
  //  • new nodes      → force = true (structural change)
  if (!force && !isLayoutDirty()) {
    return false;
  }

  // 1. Resolve responsive style values for the current terminal dimensions
  resolveNodeStyles(roots, screenWidth, screenHeight);

  // 2. Sync changed styles + measure funcs (structure managed by reconciler)
  syncYogaStyles(roots);

  // 3. Update root dimensions and calculate layout
  rootYoga.setWidth(screenWidth);
  rootYoga.setHeight(screenHeight);
  rootYoga.calculateLayout(screenWidth, screenHeight, Direction.LTR);

  // 4. Extract computed layout into GlyphNodes
  for (const child of roots) {
    if (child.hidden || !child.yogaNode) continue;
    extractLayout(child, 0, 0);
  }

  resetLayoutDirty();
  return true;
}
