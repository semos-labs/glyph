import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { FocusContext, LayoutContext } from "./context.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import type { LayoutRect } from "../types/index.js";

/**
 * Descriptor for a single focusable element in the registry.
 */
export interface FocusableElement {
  /** Unique focus ID */
  id: string;
  /** The GlyphNode */
  node: GlyphNode;
  /** Current layout (position, size) */
  layout: LayoutRect;
  /** Node type (box, input, etc.) */
  type: string;
}

/**
 * Return type of {@link useFocusRegistry}.
 */
export interface FocusRegistryValue {
  /** All currently registered focusable elements */
  elements: FocusableElement[];
  /** Currently focused element ID */
  focusedId: string | null;
  /** Request focus on a specific element */
  requestFocus: (id: string) => void;
  /** Move to next focusable element */
  focusNext: () => void;
  /** Move to previous focusable element */
  focusPrev: () => void;
  /** Manually refresh the element list (useful after layout updates) */
  refresh: () => void;
}

/**
 * Access all registered focusable elements and navigation helpers.
 *
 * Useful for building custom navigation UIs, accessibility overlays,
 * or debug tools. Respects the current {@link FocusScope} trap.
 *
 * @returns Registry value, or `null` outside a Glyph render tree.
 *
 * @example
 * ```tsx
 * const registry = useFocusRegistry();
 * if (registry) {
 *   console.log(`${registry.elements.length} focusable elements`);
 *   registry.focusNext();
 * }
 * ```
 */
export function useFocusRegistry(): FocusRegistryValue | null {
  const focusCtx = useContext(FocusContext);
  const layoutCtx = useContext(LayoutContext);
  const [elements, setElements] = useState<FocusableElement[]>([]);
  const updateRef = useRef<() => void>(() => {});

  const updateElements = useCallback(() => {
    if (!focusCtx) return;
    
    // Use getActiveElements to respect current focus trap
    const registered = focusCtx.getActiveElements?.() ?? focusCtx.getRegisteredElements?.() ?? [];
    const mapped: FocusableElement[] = registered.map(({ id, node }) => ({
      id,
      node,
      layout: layoutCtx?.getLayout(node) ?? node.layout,
      type: node.type,
    }));
    
    // Sort by visual position (top-to-bottom, left-to-right)
    mapped.sort((a, b) => {
      if (a.layout.y !== b.layout.y) {
        return a.layout.y - b.layout.y;
      }
      return a.layout.x - b.layout.x;
    });
    
    setElements(mapped);
  }, [focusCtx, layoutCtx]);

  // Store the update function in a ref so it can be called externally
  updateRef.current = updateElements;

  useEffect(() => {
    if (!focusCtx) return;

    updateElements();

    // Re-update when focus changes (elements may have been added/removed)
    const unsubscribe = focusCtx.onFocusChange(() => {
      updateElements();
    });

    // Also update after a short delay to catch layout computation
    const timer = setTimeout(updateElements, 50);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [focusCtx, layoutCtx, updateElements]);

  if (!focusCtx) return null;

  return {
    elements,
    focusedId: focusCtx.focusedId,
    requestFocus: focusCtx.requestFocus,
    focusNext: focusCtx.focusNext,
    focusPrev: focusCtx.focusPrev,
    refresh: () => updateRef.current(),
  };
}
