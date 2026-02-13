import { useContext, useEffect, useState, useRef, useMemo } from "react";
import { FocusContext } from "./context.js";
import { AppContext } from "./context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

/**
 * Return type of {@link useFocus}.
 */
interface UseFocusResult {
  /** `true` when this element currently holds focus. */
  focused: boolean;
  /** Programmatically request focus for this element. */
  focus(): void;
}

/**
 * Low-level hook that registers a node in the focus system and tracks
 * whether it is currently focused.
 *
 * For most use-cases, prefer the higher-level {@link useFocusable} hook
 * or built-in focusable components (`Button`, `Input`, …).
 *
 * @param nodeRef - React ref pointing to the underlying {@link GlyphNode}.
 * @returns An object with the current `focused` state and a `focus()` method.
 *
 * @example
 * ```tsx
 * const nodeRef = useRef<GlyphNode>(null);
 * const { focused, focus } = useFocus(nodeRef);
 *
 * <Box ref={nodeRef} focusable style={{ bg: focused ? "cyan" : undefined }}>
 *   {focused ? "I have focus!" : "Press Tab"}
 * </Box>
 * ```
 */
export function useFocus(nodeRef?: { current: GlyphNode | null }): UseFocusResult {
  const focusCtx = useContext(FocusContext);
  const [id] = useState(() => `focus-${Math.random().toString(36).slice(2, 9)}`);

  const isFocused = focusCtx ? focusCtx.focusedId === id : false;

  useEffect(() => {
    if (!focusCtx || !nodeRef?.current) return;
    // Assign the focus ID to the node
    nodeRef.current.focusId = id;
    return focusCtx.register(id, nodeRef.current);
  }, [focusCtx, id, nodeRef]);

  const focus = useMemo(() => {
    return () => {
      focusCtx?.requestFocus(id);
    };
  }, [focusCtx, id]);

  return { focused: isFocused, focus };
}
