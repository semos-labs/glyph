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
import type { GlyphNode, GlyphContainer } from "../reconciler/nodes.js";
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

function buildYogaTree(node: GlyphNode): void {
  const yogaNode = Yoga.Node.create();
  node.yogaNode = yogaNode;

  applyStyleToYogaNode(yogaNode, node.resolvedStyle, node.type);

  if (node.type === "text" || node.type === "input") {
    yogaNode.setMeasureFunc((width, widthMode, height, heightMode) => {
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
  } else {
    // Build children
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      if (child.hidden) continue;
      buildYogaTree(child);
      yogaNode.insertChild(child.yogaNode!, yogaNode.getChildCount());
    }
  }
}

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

function freeYogaTree(node: GlyphNode): void {
  for (const child of node.children) {
    if (child.yogaNode) freeYogaTree(child);
  }
  if (node.yogaNode) {
    node.yogaNode.freeRecursive();
    node.yogaNode = null;
  }
}

export function computeLayout(
  roots: GlyphNode[],
  screenWidth: number,
  screenHeight: number,
): void {
  // Resolve responsive style values for the current terminal dimensions
  resolveNodeStyles(roots, screenWidth, screenHeight);

  // Create a virtual root Yoga node for the screen
  const rootYoga = Yoga.Node.create();
  rootYoga.setWidth(screenWidth);
  rootYoga.setHeight(screenHeight);
  rootYoga.setFlexDirection(FlexDirection.Column);

  for (const child of roots) {
    if (child.hidden) continue;
    buildYogaTree(child);
    rootYoga.insertChild(child.yogaNode!, rootYoga.getChildCount());
  }

  rootYoga.calculateLayout(screenWidth, screenHeight, Direction.LTR);

  for (const child of roots) {
    if (child.hidden || !child.yogaNode) continue;
    extractLayout(child, 0, 0);
  }

  // Free yoga tree
  rootYoga.freeRecursive();

  // Clear references (they were freed)
  clearYogaRefs(roots);
}

function clearYogaRefs(nodes: GlyphNode[]): void {
  for (const node of nodes) {
    node.yogaNode = null;
    clearYogaRefs(node.children);
  }
}
