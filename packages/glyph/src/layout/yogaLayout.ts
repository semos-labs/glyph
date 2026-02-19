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
import { framePerf as perf } from "../perf.js";

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

function resetYogaNode(yogaNode: YogaNode): void {
  // Reset all layout properties to Yoga defaults so that stale values
  // from a previously applied style don't leak when React reuses a host
  // node via commitUpdate (e.g. switching between detail/list views).
  yogaNode.setWidth("auto" as any);
  yogaNode.setHeight("auto" as any);
  yogaNode.setMinWidth(NaN);    // NaN = "unset" in Yoga
  yogaNode.setMinHeight(NaN);
  yogaNode.setMaxWidth(NaN);
  yogaNode.setMaxHeight(NaN);

  yogaNode.setPadding(Edge.All, 0);
  yogaNode.setPadding(Edge.Horizontal, NaN);
  yogaNode.setPadding(Edge.Vertical, NaN);
  yogaNode.setPadding(Edge.Top, NaN);
  yogaNode.setPadding(Edge.Right, NaN);
  yogaNode.setPadding(Edge.Bottom, NaN);
  yogaNode.setPadding(Edge.Left, NaN);

  yogaNode.setBorder(Edge.All, 0);

  yogaNode.setFlexDirection(FlexDirection.Column);
  yogaNode.setFlexWrap(Wrap.NoWrap);
  yogaNode.setJustifyContent(Justify.FlexStart);
  yogaNode.setAlignItems(Align.Stretch);
  yogaNode.setFlexGrow(0);
  yogaNode.setFlexShrink(0);

  yogaNode.setGap(Gutter.All, 0);

  yogaNode.setPositionType(PositionType.Relative);
  yogaNode.setPosition(Edge.Top, NaN);
  yogaNode.setPosition(Edge.Right, NaN);
  yogaNode.setPosition(Edge.Bottom, NaN);
  yogaNode.setPosition(Edge.Left, NaN);

  yogaNode.setOverflow(Overflow.Visible);
}

function applyStyleToYogaNode(yogaNode: YogaNode, style: ResolvedStyle, nodeType: string): void {
  // Reset all properties first to clear stale values from previous styles.
  resetYogaNode(yogaNode);

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

/** Clip rect passed through extractLayout to cull off-screen subtrees. */
interface LayoutClip { minX: number; minY: number; maxX: number; maxY: number }

/** Mark all Yoga nodes in a subtree as layout-seen (resets hasNewLayout). */
function markSubtreeLayoutSeen(node: GlyphNode): void {
  for (const child of node.children) {
    if (!child.yogaNode) continue;
    if (child.yogaNode.hasNewLayout()) child.yogaNode.markLayoutSeen();
    markSubtreeLayoutSeen(child);
  }
}

function extractLayout(
  node: GlyphNode,
  parentX: number,
  parentY: number,
  parentMoved: boolean,
  clip: LayoutClip | null,
): void {
  const yn = node.yogaNode!;
  const hasNew = yn.hasNewLayout();

  // Fast path: Yoga didn't recalculate this node AND parent didn't move.
  if (!hasNew && !parentMoved) {
    for (const child of node.children) {
      if (child.hidden || !child.yogaNode) continue;
      extractLayout(child, node.layout!.x, node.layout!.y, false, clip);
    }
    return;
  }

  if (hasNew) yn.markLayoutSeen();

  // ── Step 1: Determine absolute position ──
  let x: number, y: number, width: number, height: number;

  if (hasNew) {
    const cl = yn.getComputedLayout();
    x = parentX + cl.left;
    y = parentY + cl.top;
    width = cl.width;
    height = cl.height;
    node._relLeft = cl.left;
    node._relTop = cl.top;
  } else {
    // parentMoved — the node itself wasn't recalculated, but its parent
    // shifted so its absolute position changed.  Use cached relative
    // offsets for position, but ALWAYS read dimensions from Yoga.
    //
    // We cannot use prev.width/prev.height because newly-created nodes
    // (e.g. unique-key list items) may enter this branch with stale
    // default layout {0,0,0,0} if Yoga didn't flag hasNewLayout for
    // them (it flags the *parent* that gained new children, but
    // children whose own computed values haven't changed from Yoga's
    // initial defaults may not get the flag).
    x = parentX + node._relLeft;
    y = parentY + node._relTop;
    width = yn.getComputedWidth();
    height = yn.getComputedHeight();
  }

  // ── Step 2: Clip cull ──
  if (clip &&
      (y + height <= clip.minY || y >= clip.maxY ||
       x + width  <= clip.minX || x >= clip.maxX)) {
    const prev = node.layout;
    if (prev && (prev.x !== x || prev.y !== y || prev.width !== width || prev.height !== height)) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dw = width - prev.width;
      const dh = height - prev.height;
      node._prevLayout = prev;
      node.layout = {
        x, y, width, height,
        innerX: prev.innerX + dx,
        innerY: prev.innerY + dy,
        innerWidth: prev.innerWidth + dw,
        innerHeight: prev.innerHeight + dh,
      };
      node._paintDirty = true;
    }
    if (hasNew) markSubtreeLayoutSeen(node);
    return;
  }

  // ── Step 3: Full layout extraction ──
  let layoutChanged = false;

  if (hasNew) {
    const bw = node.resolvedStyle.border && node.resolvedStyle.border !== "none" ? 1 : 0;
    const padTop = yn.getComputedPadding(Edge.Top);
    const padRight = yn.getComputedPadding(Edge.Right);
    const padBottom = yn.getComputedPadding(Edge.Bottom);
    const padLeft = yn.getComputedPadding(Edge.Left);

    const innerX = x + bw + padLeft;
    const innerY = y + bw + padTop;
    const innerWidth = Math.max(0, width - bw * 2 - padLeft - padRight);
    const innerHeight = Math.max(0, height - bw * 2 - padTop - padBottom);

    const prev = node.layout;
    if (!prev ||
        prev.x !== x || prev.y !== y ||
        prev.width !== width || prev.height !== height ||
        prev.innerX !== innerX || prev.innerY !== innerY ||
        prev.innerWidth !== innerWidth || prev.innerHeight !== innerHeight) {
      node._prevLayout = prev;
      node.layout = { x, y, width, height, innerX, innerY, innerWidth, innerHeight };
      node._paintDirty = true;
      layoutChanged = true;
    }
  } else {
    const prev = node.layout!;
    const dx = x - prev.x;
    const dy = y - prev.y;
    const dw = width - prev.width;
    const dh = height - prev.height;
    if (dx !== 0 || dy !== 0 || dw !== 0 || dh !== 0) {
      node._prevLayout = prev;
      node.layout = {
        x, y, width, height,
        innerX: prev.innerX + dx,
        innerY: prev.innerY + dy,
        innerWidth: prev.innerWidth + dw,
        innerHeight: prev.innerHeight + dh,
      };
      node._paintDirty = true;
      layoutChanged = true;
    }
  }

  // ── Step 4: Compute child clip and recurse ──
  let childClip = clip;
  if (node.resolvedStyle.clip && node.layout) {
    const l = node.layout;
    const nc: LayoutClip = { minX: l.x, minY: l.y, maxX: l.x + l.width, maxY: l.y + l.height };
    if (nc.maxX > nc.minX && nc.maxY > nc.minY) {
      childClip = clip
        ? { minX: Math.max(clip.minX, nc.minX), minY: Math.max(clip.minY, nc.minY),
            maxX: Math.min(clip.maxX, nc.maxX), maxY: Math.min(clip.maxY, nc.maxY) }
        : nc;
    }
  }

  for (const child of node.children) {
    if (child.hidden || !child.yogaNode) continue;
    extractLayout(child, node.layout!.x, node.layout!.y, layoutChanged, childClip);
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
  const t0 = performance.now();
  resolveNodeStyles(roots, screenWidth, screenHeight);
  perf.resolveStyles = performance.now() - t0;

  // 2. Sync changed styles + measure funcs (structure managed by reconciler)
  const t1 = performance.now();
  syncYogaStyles(roots);
  perf.syncYogaStyles = performance.now() - t1;

  // 3. Update root dimensions and calculate layout
  const t2 = performance.now();
  rootYoga.setWidth(screenWidth);
  rootYoga.setHeight(screenHeight);
  rootYoga.calculateLayout(screenWidth, screenHeight, Direction.LTR);
  perf.yogaCalculate = performance.now() - t2;

  // 4. Extract computed layout into GlyphNodes
  // Start with no clip — only nodes with clip:true (ScrollView etc.) will
  // create clip rects for their children.  Root-level overflow must still
  // get valid layout for tests, scrolling math, etc.
  const t3 = performance.now();
  for (const child of roots) {
    if (child.hidden || !child.yogaNode) continue;
    extractLayout(child, 0, 0, force, null);
  }
  perf.extractLayout = performance.now() - t3;

  resetLayoutDirty();
  return true;
}
