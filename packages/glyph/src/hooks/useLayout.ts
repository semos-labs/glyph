import { useContext, useState, useEffect } from "react";
import { LayoutContext } from "./context.js";
import type { LayoutRect } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";

const DEFAULT_RECT: LayoutRect = {
  x: 0, y: 0, width: 0, height: 0,
  innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0,
};

/**
 * Subscribe to the computed layout of a node.
 *
 * Returns a {@link LayoutRect} that updates whenever the layout engine
 * recalculates positions (e.g. on resize or content change).
 *
 * @param nodeRef - React ref pointing to the target {@link GlyphNode}.
 * @returns Current layout rectangle (outer + inner bounds).
 *
 * @example
 * ```tsx
 * const boxRef = useRef<GlyphNode>(null);
 * const layout = useLayout(boxRef);
 *
 * <Box ref={boxRef}>
 *   <Text>Width: {layout.innerWidth} Height: {layout.innerHeight}</Text>
 * </Box>
 * ```
 * @category Hooks
 */
export function useLayout(nodeRef?: { current: GlyphNode | null }): LayoutRect {
  const ctx = useContext(LayoutContext);
  const [layout, setLayout] = useState<LayoutRect>(DEFAULT_RECT);

  useEffect(() => {
    if (!ctx || !nodeRef?.current) return;
    setLayout(ctx.getLayout(nodeRef.current));
    return ctx.subscribe(nodeRef.current, setLayout);
  }, [ctx, nodeRef]);

  return layout;
}
