import { useContext, useCallback } from "react";
import { ScrollViewContext, nodeScrollContextMap } from "./context.js";
import type { ScrollIntoViewOptions, ScrollViewContextValue } from "./context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

/**
 * Walk up the GlyphNode parent chain to find the nearest ScrollView
 * context registered in the `nodeScrollContextMap`.  This allows the
 * hook to work even when called from **outside** the ScrollView's
 * React subtree (e.g. a parent or sibling component).
 */
function findScrollContextFromNode(node: GlyphNode): ScrollViewContextValue | null {
  let current: GlyphNode | null = node.parent;
  while (current) {
    const ctx = nodeScrollContextMap.get(current);
    if (ctx) return ctx;
    current = current.parent;
  }
  return null;
}

/**
 * Returns a function that scrolls the nearest parent {@link ScrollView}
 * to make the referenced node visible.
 *
 * This is the non-focusable counterpart to `handle.scrollIntoView()` —
 * use it with plain `Box` refs or any `GlyphNode`.
 *
 * Works both when the calling component is **inside** the ScrollView
 * (via React context) and when it is **outside** (by walking up the
 * target node's parent chain).
 *
 * @param nodeRef - React ref pointing to the target node.
 * @returns A stable callback you can invoke to scroll to the node.
 *
 * @example
 * ```tsx
 * const boxRef = useRef<GlyphNode>(null);
 * const scrollIntoView = useScrollIntoView(boxRef);
 *
 * // Later, e.g. in an effect or event handler:
 * scrollIntoView();                       // minimal scroll
 * scrollIntoView({ block: "center" });    // center in viewport
 * ```
 * @category Navigation
 */
export function useScrollIntoView(
  nodeRef: { current: GlyphNode | null },
): (options?: ScrollIntoViewOptions) => void {
  const scrollCtx = useContext(ScrollViewContext);

  return useCallback(
    (options?: ScrollIntoViewOptions) => {
      if (!nodeRef.current) return;
      // Prefer the React context (caller is inside the ScrollView tree),
      // but fall back to walking up the GlyphNode parent chain when the
      // hook is used from outside the ScrollView.
      const ctx = scrollCtx ?? findScrollContextFromNode(nodeRef.current);
      if (!ctx) return;
      ctx.scrollTo(nodeRef.current, options);
    },
    [scrollCtx, nodeRef],
  );
}
