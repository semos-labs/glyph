import { useContext, useEffect, useRef } from "react";
import type { MouseEvent } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { MouseContext } from "./context.js";

/**
 * Subscribe to all global mouse events.
 *
 * The handler receives every mouse event (click, move, wheel) along with
 * the hit-tested `GlyphNode` at the cursor position (or `null` if none).
 *
 * @example
 * ```tsx
 * useMouse((event, node) => {
 *   if (event.type === "mousedown") {
 *     console.log("Clicked at", event.x, event.y);
 *   }
 * });
 * ```
 * @category Input
 */
export function useMouse(
  handler: (event: MouseEvent, node: GlyphNode | null) => void,
): void {
  const mouseCtx = useContext(MouseContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!mouseCtx) return;
    return mouseCtx.subscribe((event, node) => {
      handlerRef.current(event, node);
    });
  }, [mouseCtx]);
}
