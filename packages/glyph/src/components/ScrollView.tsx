import React, { useRef, useState, useCallback, useEffect, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { Style, Key } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { useLayout } from "../hooks/useLayout.js";
import { useInput } from "../hooks/useInput.js";
import { FocusContext, LayoutContext, ScrollViewContext } from "../hooks/context.js";
import type { ScrollViewContextValue, ScrollViewBounds } from "../hooks/context.js";

/**
 * Visible range passed to the render function in virtualized mode.
 * Contains the start/end indices and viewport metadata.
 */
export interface VisibleRange {
  /** First visible line index (0-based) */
  start: number;
  /** One past the last visible line index */
  end: number;
  /** Current scroll offset */
  scrollOffset: number;
  /** Viewport height in lines */
  viewportHeight: number;
}

/**
 * Props for the {@link ScrollView} component.
 */
export interface ScrollViewProps {
  /** 
   * Children to render. When `virtualize` is true, only visible children are rendered.
   * Can also be a render function `(range: VisibleRange) => ReactNode` for line-based virtualization.
   */
  children?: ReactNode | ((range: VisibleRange) => ReactNode);
  style?: Style;
  /** Controlled scroll offset (rows from top) */
  scrollOffset?: number;
  /** Callback when scroll offset should change (controlled mode) */
  onScroll?: (offset: number) => void;
  /** Initial offset for uncontrolled mode */
  defaultScrollOffset?: number;
  /** Lines to scroll per arrow key press (default: 1) */
  scrollStep?: number;
  /** Disable keyboard scrolling */
  disableKeyboard?: boolean;
  /** Auto-scroll to focused element (default: true) */
  scrollToFocus?: boolean;
  /** Show scrollbar when content is scrollable (default: true) */
  showScrollbar?: boolean;
  /** Make ScrollView itself focusable. Default: true. Set to false if you want scroll to follow child focus only. */
  focusable?: boolean;
  /** Style applied when ScrollView is focused */
  focusedStyle?: Style;
  /** 
   * Total content height in lines (for render function mode).
   * When set with a render function, enables line-based virtualization.
   */
  totalLines?: number;
  /** Extra lines to render above/below viewport (default: 2) */
  overscan?: number;
  /**
   * Enable virtualization. When true, only visible children are rendered.
   * Heights are auto-measured - no need to specify them!
   */
  virtualize?: boolean;
  /**
   * Estimated height per child in lines (default: 1).
   * Used for initial scroll calculations before actual heights are measured.
   */
  estimatedItemHeight?: number;
}

/**
 * Scrollable container with optional built-in virtualization.
 *
 * Supports three modes:
 * 1. **Basic** — wraps arbitrary content and scrolls via keyboard.
 * 2. **Array virtualization** — set `virtualize` to only render visible children.
 * 3. **Line virtualization** — pass a render function + `totalLines` for giant lists.
 *
 * Auto-scrolls to keep the focused child visible when `scrollToFocus` is `true` (default).
 *
 * **Keyboard shortcuts** (when the ScrollView or a child has focus):
 * | Key | Action |
 * |---|---|
 * | Page Up / Page Down | Scroll one page |
 * | Ctrl+D / Ctrl+U | Half-page down / up |
 * | Ctrl+F / Ctrl+B | Full-page down / up |
 *
 * @example
 * ```tsx
 * // Basic scrollable content
 * <ScrollView style={{ height: 10, border: "round" }}>
 *   {items.map((item) => (
 *     <Text key={item.id}>{item.name}</Text>
 *   ))}
 * </ScrollView>
 * ```
 *
 * @example
 * ```tsx
 * // Virtualized — only visible children are mounted
 * <ScrollView virtualize style={{ height: 20 }}>
 *   {thousandsOfItems.map((item) => (
 *     <Text key={item.id}>{item.name}</Text>
 *   ))}
 * </ScrollView>
 * ```
 *
 * @example
 * ```tsx
 * // Line-based virtualization with render function
 * <ScrollView totalLines={100_000} style={{ height: 20 }}>
 *   {({ start, end }) =>
 *     Array.from({ length: end - start }, (_, i) => (
 *       <Text key={start + i}>Line {start + i}</Text>
 *     ))
 *   }
 * </ScrollView>
 * ```
 */
export function ScrollView({
  children,
  style,
  scrollOffset: controlledOffset,
  onScroll,
  defaultScrollOffset = 0,
  scrollStep = 1,
  disableKeyboard,
  scrollToFocus = true,
  showScrollbar = true,
  focusable = true,
  focusedStyle,
  totalLines,
  overscan = 2,
  virtualize = false,
  estimatedItemHeight = 1,
}: ScrollViewProps): React.JSX.Element {
  const isControlled = controlledOffset !== undefined;
  const [internalOffset, setInternalOffset] = useState(defaultScrollOffset);
  const offset = isControlled ? controlledOffset : internalOffset;

  // Check what kind of children we have
  const isRenderFunction = typeof children === "function";
  
  // Convert children to array for virtualization (handles fragments, single elements, etc.)
  const childArray = useMemo(() => {
    if (isRenderFunction) return [];
    return React.Children.toArray(children);
  }, [children, isRenderFunction]);
  
  // Line-based virtualization: render function + totalLines
  const isLineVirtualized = totalLines !== undefined && isRenderFunction;
  
  // Array virtualization: enabled when virtualize flag is set and we have children
  const isArrayVirtualized = virtualize && !isRenderFunction && childArray.length > 0;

  const viewportRef = useRef<GlyphNode | null>(null);
  const contentRef = useRef<GlyphNode | null>(null);
  const viewportLayout = useLayout(viewportRef);
  const contentLayout = useLayout(contentRef);
  
  // Track measured heights for array items (index -> height in lines)
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());
  const itemRefsRef = useRef<Map<number, GlyphNode>>(new Map());
  
  const focusCtx = useContext(FocusContext);
  const layoutCtx = useContext(LayoutContext);

  // Generate stable focus ID for this ScrollView if focusable
  const focusIdRef = useRef<string | null>(null);
  if (focusable && !focusIdRef.current) {
    focusIdRef.current = `scrollview-${Math.random().toString(36).slice(2, 9)}`;
  }
  const focusId = focusable ? focusIdRef.current : null;

  // Register with focus system if focusable
  useEffect(() => {
    if (!focusable || !focusId || !focusCtx || !viewportRef.current) return;
    return focusCtx.register(focusId, viewportRef.current);
  }, [focusable, focusId, focusCtx]);

  // Check if this ScrollView is directly focused
  const isSelfFocused = focusable && focusId && focusCtx?.focusedId === focusId;

  const viewportHeight = viewportLayout.innerHeight;
  
  // Calculate total content height based on mode
  const getArrayTotalHeight = useCallback(() => {
    if (!isArrayVirtualized) return 0;
    let total = 0;
    for (let i = 0; i < childArray.length; i++) {
      total += measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
    }
    return total;
  }, [isArrayVirtualized, childArray.length, estimatedItemHeight]);
  
  // Content height: line-virtualized uses totalLines, array-virtualized calculates, otherwise measure
  const contentHeight = isLineVirtualized 
    ? totalLines! 
    : isArrayVirtualized 
      ? getArrayTotalHeight() 
      : contentLayout.height;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);

  // Always clamp the effective offset used for rendering
  const effectiveOffset = Math.max(0, Math.min(offset, maxOffset));

  // Provide ScrollView context for children (e.g., Select) to know their boundaries
  const scrollViewContextValue = useMemo((): ScrollViewContextValue => ({
    getBounds: (): ScrollViewBounds => {
      const viewportY = viewportLayout.y;
      return {
        visibleTop: viewportY,
        visibleBottom: viewportY + viewportHeight,
        viewportHeight,
        scrollOffset: effectiveOffset,
      };
    },
  }), [viewportLayout.y, viewportHeight, effectiveOffset]);

  const setOffset = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, maxOffset));
      if (isControlled) {
        onScroll?.(clamped);
      } else {
        setInternalOffset(clamped);
      }
    },
    [isControlled, onScroll, maxOffset],
  );

  // Re-clamp when content/viewport changes
  useEffect(() => {
    if (offset > maxOffset && maxOffset >= 0) {
      setOffset(maxOffset);
    }
  }, [offset, maxOffset, setOffset]);

  // Focus-aware scrolling: scroll to make focused element visible
  useEffect(() => {
    if (!scrollToFocus || !focusCtx || !layoutCtx || !contentRef.current) return;

    const unsubscribe = focusCtx.onFocusChange((focusedId) => {
      if (!focusedId || !contentRef.current) return;

      // Find the focused node by walking the content tree
      const findNode = (node: GlyphNode): GlyphNode | null => {
        if (node.focusId === focusedId) return node;
        for (const child of node.children) {
          const found = findNode(child);
          if (found) return found;
        }
        return null;
      };

      const focusedNode = findNode(contentRef.current);
      if (!focusedNode) return; // Focused element is not inside this ScrollView

      // Get layout of focused element relative to content
      const focusedLayout = layoutCtx.getLayout(focusedNode);
      const contentTopY = contentRef.current.layout?.y ?? 0;
      
      // Calculate element position relative to content top
      const elementTop = focusedLayout.y - contentTopY;
      const elementBottom = elementTop + focusedLayout.height;
      
      // Current visible range
      const visibleTop = offset;
      const visibleBottom = offset + viewportHeight;
      
      // Check if element is fully visible
      if (elementTop < visibleTop) {
        // Element is above visible area - scroll up
        setOffset(elementTop);
      } else if (elementBottom > visibleBottom) {
        // Element is below visible area - scroll down
        setOffset(elementBottom - viewportHeight);
      }
    });

    return unsubscribe;
  }, [scrollToFocus, focusCtx, layoutCtx, offset, viewportHeight, setOffset]);

  // Check if this ScrollView contains the currently focused element (or is itself focused)
  const containsFocus = useCallback((): boolean => {
    if (!focusCtx) return false;
    const currentFocusId = focusCtx.focusedId;
    if (!currentFocusId) return false;

    // Check if ScrollView itself is focused
    if (focusable && focusId && currentFocusId === focusId) return true;

    // Walk the content tree to find if focused element is inside
    if (!contentRef.current) return false;
    const findNode = (node: GlyphNode): boolean => {
      if (node.focusId === currentFocusId) return true;
      for (const child of node.children) {
        if (findNode(child)) return true;
      }
      return false;
    };

    return findNode(contentRef.current);
  }, [focusCtx, focusable, focusId]);

  useInput((key: Key) => {
    if (disableKeyboard) return;

    // Only respond to scroll keys if this ScrollView contains focus
    // This prevents multiple ScrollViews from all scrolling at once
    if (!containsFocus()) return;

    const halfPage = Math.max(1, Math.floor(viewportHeight / 2));
    const fullPage = Math.max(1, viewportHeight);

    // Check if a text input is likely focused (skip conflicting vim keys)
    // We use Page Up/Down which never conflict with text inputs
    
    switch (key.name) {
      // Page keys - always safe, inputs don't use these
      case "pageup":
        setOffset(offset - fullPage);
        break;
      case "pagedown":
        setOffset(offset + fullPage);
        break;
      default:
        // Ctrl combinations that don't conflict with input editing
        if (key.ctrl) {
          if (key.name === "d") {
            // Ctrl+D - half page down
            setOffset(offset + halfPage);
          } else if (key.name === "u") {
            // Ctrl+U - half page up
            setOffset(offset - halfPage);
          } else if (key.name === "f") {
            // Ctrl+F - full page down
            setOffset(offset + fullPage);
          } else if (key.name === "b") {
            // Ctrl+B - full page up
            setOffset(offset - fullPage);
          }
        }
        break;
    }
  }, [offset, scrollStep, viewportHeight, maxOffset, disableKeyboard, setOffset, containsFocus]);

  // Extract padding from the user style — it must live on the inner content
  // wrapper, not the outer viewport.  The clip region is the outer box's
  // *content area* (after border + padding).  The inner absolute child is
  // positioned relative to the *padding box* (after border only).  If padding
  // stays on the outer box, the first columns/rows of content fall outside the
  // clip and get cut off.
  const {
    padding: _pad,
    paddingX: _px,
    paddingY: _py,
    paddingTop: _pt,
    paddingRight: _pr,
    paddingBottom: _pb,
    paddingLeft: _pl,
    ...styleRest
  } = style ?? {};

  // Calculate intrinsic height (content + border if any)
  const hasBorder = styleRest.border != null && styleRest.border !== "none";
  const borderHeight = hasBorder ? 2 : 0;
  const intrinsicHeight = contentHeight > 0 ? contentHeight + borderHeight : undefined;
  
  // Outer viewport style:
  // - If no explicit height set by user, use content height as intrinsic size
  // - flexShrink: 1 allows shrinking when parent constrains (e.g., maxHeight)
  // - minHeight: 0 allows shrinking to any size
  // - clip: true enables content clipping for scrolling
  const outerStyle: Style = {
    ...styleRest,
    ...(isSelfFocused ? focusedStyle : {}),
    clip: true,
    // Only set intrinsic height if user didn't set explicit height
    ...(styleRest.height === undefined && intrinsicHeight !== undefined
      ? {
          height: intrinsicHeight,
          flexShrink: styleRest.flexShrink ?? 1,
          minHeight: styleRest.minHeight ?? 0,
        }
      : {}),
  };

  // Calculate visible range for line-based virtualization
  const visibleRange = useMemo((): VisibleRange => {
    const start = Math.max(0, effectiveOffset - overscan);
    const end = Math.min(totalLines ?? contentHeight, effectiveOffset + viewportHeight + overscan);
    return {
      start,
      end,
      scrollOffset: effectiveOffset,
      viewportHeight,
    };
  }, [effectiveOffset, viewportHeight, overscan, totalLines, contentHeight]);

  // Calculate visible items for array virtualization
  const getVisibleArrayItems = useCallback((): { startIndex: number; endIndex: number; startOffset: number } => {
    if (!isArrayVirtualized) return { startIndex: 0, endIndex: 0, startOffset: 0 };
    
    let currentOffset = 0;
    let startIndex = 0;
    let startOffset = 0;
    
    // Find first visible item
    for (let i = 0; i < childArray.length; i++) {
      const itemHeight = measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
      if (currentOffset + itemHeight > effectiveOffset - overscan) {
        startIndex = i;
        startOffset = currentOffset;
        break;
      }
      currentOffset += itemHeight;
      startIndex = i + 1;
      startOffset = currentOffset;
    }
    
    // Find last visible item
    let endIndex = startIndex;
    for (let i = startIndex; i < childArray.length; i++) {
      const itemHeight = measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
      endIndex = i + 1;
      currentOffset += itemHeight;
      if (currentOffset >= effectiveOffset + viewportHeight + overscan) {
        break;
      }
    }
    
    return { startIndex, endIndex, startOffset };
  }, [isArrayVirtualized, childArray.length, effectiveOffset, viewportHeight, overscan, estimatedItemHeight]);

  const arrayVisibility = getVisibleArrayItems();

  // Inner content: absolutely positioned to fill viewport width,
  // shifted up by scrollOffset. Padding lives here so text is indented
  // without being clipped.
  // In virtualized mode, we render at the visible start position.
  const innerStyle: Style = {
    position: "absolute" as const,
    top: isLineVirtualized 
      ? visibleRange.start - effectiveOffset 
      : isArrayVirtualized 
        ? arrayVisibility.startOffset - effectiveOffset
        : -effectiveOffset,
    left: 0,
    right: 0,
    flexDirection: "column" as const,
    ...(_pad !== undefined && { padding: _pad }),
    ...(_px !== undefined && { paddingX: _px }),
    ...(_py !== undefined && { paddingY: _py }),
    ...(_pt !== undefined && { paddingTop: _pt }),
    ...(_pr !== undefined && { paddingRight: _pr }),
    ...(_pb !== undefined && { paddingBottom: _pb }),
    ...(_pl !== undefined && { paddingLeft: _pl }),
  };

  // Resolve children based on mode
  const renderedChildren: ReactNode = isLineVirtualized 
    ? (children as (range: VisibleRange) => ReactNode)(visibleRange)
    : isArrayVirtualized
      ? childArray.slice(arrayVisibility.startIndex, arrayVisibility.endIndex).map((child, i) => {
          const actualIndex = arrayVisibility.startIndex + i;
          return React.createElement(
            "box" as any,
            {
              key: actualIndex,
              ref: (node: GlyphNode | null) => {
                if (node) {
                  itemRefsRef.current.set(actualIndex, node);
                } else {
                  itemRefsRef.current.delete(actualIndex);
                }
              },
            },
            child
          );
        })
      : (children as ReactNode);

  // Measure item heights after render (for array virtualization)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isArrayVirtualized || !layoutCtx) return;
    
    let needsUpdate = false;
    for (const [index, node] of itemRefsRef.current) {
      const layout = layoutCtx.getLayout(node);
      const measuredHeight = layout.height || estimatedItemHeight;
      const currentHeight = measuredHeightsRef.current.get(index);
      
      if (currentHeight !== measuredHeight) {
        measuredHeightsRef.current.set(index, measuredHeight);
        needsUpdate = true;
      }
    }
    
    // Trigger re-render if heights changed to recalculate total content height
    if (needsUpdate) {
      forceUpdate(n => n + 1);
    }
  });

  // Calculate scrollbar dimensions
  const isScrollable = contentHeight > viewportHeight && viewportHeight > 0;
  const scrollbarVisible = showScrollbar && isScrollable;
  
  // Scrollbar thumb size and position
  const thumbHeight = Math.max(1, Math.floor((viewportHeight / contentHeight) * viewportHeight));
  const scrollableRange = contentHeight - viewportHeight;
  const thumbPosition = scrollableRange > 0 
    ? Math.floor((effectiveOffset / scrollableRange) * (viewportHeight - thumbHeight))
    : 0;

  // Build scrollbar characters
  const scrollbarChars: string[] = [];
  if (scrollbarVisible) {
    for (let i = 0; i < viewportHeight; i++) {
      if (i >= thumbPosition && i < thumbPosition + thumbHeight) {
        scrollbarChars.push("█");
      } else {
        scrollbarChars.push("░");
      }
    }
  }

  // Scrollbar style - positioned on the right edge
  const scrollbarStyle: Style = {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 1,
    height: viewportHeight,
    flexDirection: "column" as const,
  };

  return React.createElement(
    ScrollViewContext.Provider,
    { value: scrollViewContextValue },
    React.createElement(
      "box" as any,
      {
        style: outerStyle,
        ref: (node: any) => {
          viewportRef.current = node ?? null;
        },
        ...(focusable ? { focusable: true, focusId } : {}),
      },
      // Content (absolutely positioned, scrolls via top offset)
      React.createElement(
        "box" as any,
        {
          style: {
            ...innerStyle,
            // Reserve space for scrollbar when visible
            paddingRight: scrollbarVisible ? (innerStyle.paddingRight ?? 0) + 1 : innerStyle.paddingRight,
          },
          ref: (node: any) => {
            contentRef.current = node ?? null;
          },
        },
        renderedChildren,
      ),
      // Scrollbar
      scrollbarVisible && React.createElement(
        "box" as any,
        { style: scrollbarStyle },
        React.createElement(
          "text" as any,
          { style: { color: "blackBright" as const } },
          scrollbarChars.join("\n"),
        ),
      ),
    ),
  );
}
