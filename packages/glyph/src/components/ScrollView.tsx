import React, { useRef, useState, useCallback, useEffect, useContext, useMemo, useImperativeHandle, forwardRef } from "react";
import type { ReactNode } from "react";
import type { Style, Key } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { useLayout } from "../hooks/useLayout.js";
import { useInput } from "../hooks/useInput.js";
import { FocusContext, InputContext, LayoutContext, ScrollViewContext, nodeScrollContextMap } from "../hooks/context.js";
import type { ScrollViewContextValue, ScrollViewBounds, ScrollIntoViewOptions } from "../hooks/context.js";

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
   * Children to render. Can also be a render function
   * `(range: VisibleRange) => ReactNode` for line-based virtualization.
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
   * Enable sliding-window virtualization for array children.
   * When true, only visible items (+ overscan) are mounted.
   * When false (default), all children are rendered and clipped — like
   * browser overflow scrolling.  This gives Yoga full layout info so
   * `scrollIntoView` / follow-focus positions are always accurate.
   */
  virtualize?: boolean;
  /**
   * Estimated height per child in lines (default: 1).
   * Only used in virtualized mode for initial scroll calculations
   * before actual heights are measured.
   */
  estimatedItemHeight?: number;
}

/**
 * Imperative handle exposed by `ScrollView` via `React.forwardRef`.
 *
 * @example
 * ```tsx
 * const ref = useRef<ScrollViewHandle>(null);
 * <ScrollView ref={ref} style={{ height: 20 }}>
 *   {items.map(…)}
 * </ScrollView>
 *
 * // Scroll to item index 10, centered:
 * ref.current?.scrollToIndex(10, { block: "center" });
 * ```
 * @category Layout
 */
export interface ScrollViewHandle {
  /** Scroll to make the child at `index` visible (even off-screen items). */
  scrollToIndex(index: number, options?: ScrollIntoViewOptions): void;
  /** Scroll to make the given node visible. */
  scrollTo(node: GlyphNode, options?: ScrollIntoViewOptions): void;
}

/**
 * Scrollable container.
 *
 * Supports three modes:
 * 1. **Array children** (default) — all children rendered, overflow clipped.
 *    Yoga has every layout position, so follow-focus is pixel-perfect.
 * 2. **Virtualized array** (`virtualize` prop) — only visible items mounted
 *    (sliding window).  Good for huge lists where rendering everything would
 *    be too expensive.
 * 3. **Line virtualization** — pass a render function + `totalLines`.
 *
 * Auto-scrolls to keep the focused child visible when `scrollToFocus` is
 * `true` (default).
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
 * // Basic scrollable list — all children rendered, overflow clipped
 * <ScrollView style={{ height: 10, border: "round" }}>
 *   {items.map((item) => (
 *     <Text key={item.id}>{item.name}</Text>
 *   ))}
 * </ScrollView>
 * ```
 *
 * @example
 * ```tsx
 * // Virtualized list — only visible items mounted
 * <ScrollView virtualize style={{ height: 10, border: "round" }}>
 *   {items.map((item) => (
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
 * @category Layout
 */
export const ScrollView = forwardRef<ScrollViewHandle, ScrollViewProps>(function ScrollView({
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
}: ScrollViewProps, ref: React.Ref<ScrollViewHandle>): React.JSX.Element {
  const isControlled = controlledOffset !== undefined;
  const [internalOffset, setInternalOffset] = useState(defaultScrollOffset);
  const offset = isControlled ? controlledOffset : internalOffset;

  // ── Children classification ──
  const isRenderFunction = typeof children === "function";

  // Flatten children into a stable array (handles fragments, single elements, etc.)
  const childArray = useMemo(() => {
    if (isRenderFunction) return [];
    return React.Children.toArray(children);
  }, [children, isRenderFunction]);

  const isLineVirtualized = totalLines !== undefined && isRenderFunction;
  const isArrayMode = !isRenderFunction && childArray.length > 0;
  const isArrayVirtualized = !!virtualize && isArrayMode;

  // ── Refs ──
  const viewportRef = useRef<GlyphNode | null>(null);
  const contentRef = useRef<GlyphNode | null>(null);
  const viewportLayout = useLayout(viewportRef);

  // For single-child / non-virtualized mode we measure the content wrapper
  const contentLayout = useLayout(contentRef);

  // Per-item measured heights (index → rows) — used only in virtualized mode
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());
  const itemRefsRef = useRef<Map<number, GlyphNode>>(new Map());

  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  const layoutCtx = useContext(LayoutContext);

  // ── Focus ID for the ScrollView itself ──
  const focusIdRef = useRef<string | null>(null);
  if (focusable && !focusIdRef.current) {
    focusIdRef.current = `scrollview-${Math.random().toString(36).slice(2, 9)}`;
  }
  const focusId = focusable ? focusIdRef.current : null;

  useEffect(() => {
    if (!focusable || !focusId || !focusCtx || !viewportRef.current) return;
    return focusCtx.register(focusId, viewportRef.current);
  }, [focusable, focusId, focusCtx]);

  const isSelfFocused = focusable && focusId && focusCtx?.focusedId === focusId;

  // ── Viewport metrics ──
  const viewportHeight = viewportLayout.innerHeight;

  // ── Effective padding on the inner content wrapper ──
  // Needed for virtualized mode where content height is computed
  // from the heights map (must include padding).
  const contentPadTop = ((style?.paddingTop ?? style?.paddingY ?? style?.padding ?? 0) as number);
  const contentPadBottom = ((style?.paddingBottom ?? style?.paddingY ?? style?.padding ?? 0) as number);

  // ── Content height ──
  // Virtualized array: padding + sum of estimated/measured item heights.
  // Non-virtualized array / single-child: Yoga-measured content wrapper height.
  // Line mode: totalLines.
  const getArrayContentHeight = useCallback((): number => {
    let total = 0;
    for (let i = 0; i < childArray.length; i++) {
      total += measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
    }
    return contentPadTop + total + contentPadBottom;
  }, [childArray.length, estimatedItemHeight, contentPadTop, contentPadBottom]);

  const contentHeight = isLineVirtualized
    ? totalLines!
    : isArrayVirtualized
      ? getArrayContentHeight()
      : contentLayout.height;

  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  const effectiveOffset = Math.max(0, Math.min(offset, maxOffset));

  // ── Lazy refs (accessed outside the render cycle) ──
  const offsetRef = useRef(effectiveOffset);
  offsetRef.current = effectiveOffset;
  const viewportHeightRef = useRef(viewportHeight);
  viewportHeightRef.current = viewportHeight;
  const setOffsetRef = useRef<(n: number) => void>(() => {});

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
  setOffsetRef.current = setOffset;

  // ── Visible range (virtualized array mode) ──
  // Determines which children are mounted.  Includes overscan rows
  // above and below the viewport for smoother scrolling.
  //
  // Offsets are in **content-space** (padding included), matching the
  // values returned by `getItemContentTop` and `getArrayContentHeight`.
  const getVisibleRange = useCallback((): {
    startIndex: number;
    endIndex: number;
    startOffset: number;
    partialClip: number;
  } => {
    if (!isArrayVirtualized) return { startIndex: 0, endIndex: 0, startOffset: 0, partialClip: 0 };

    // Item positions start after paddingTop
    let currentOffset = contentPadTop;
    let startIndex = 0;
    let startOffset = contentPadTop;

    for (let i = 0; i < childArray.length; i++) {
      const h = measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
      if (currentOffset + h > effectiveOffset - overscan) {
        startIndex = i;
        startOffset = currentOffset;
        break;
      }
      currentOffset += h;
      startIndex = i + 1;
      startOffset = currentOffset;
    }

    let endIndex = startIndex;
    currentOffset = startOffset;
    for (let i = startIndex; i < childArray.length; i++) {
      const h = measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
      endIndex = i + 1;
      currentOffset += h;
      if (currentOffset >= effectiveOffset + viewportHeight + overscan) break;
    }

    const partialClip = Math.max(0, effectiveOffset - startOffset);
    return { startIndex, endIndex, startOffset, partialClip };
  }, [isArrayVirtualized, childArray.length, effectiveOffset, viewportHeight, overscan, estimatedItemHeight, contentPadTop]);

  const visibility = getVisibleRange();

  // ── Visible range (line-based virtualization) ──
  const visibleRange = useMemo((): VisibleRange => {
    const start = Math.max(0, effectiveOffset - overscan);
    const end = Math.min(totalLines ?? contentHeight, effectiveOffset + viewportHeight + overscan);
    return { start, end, scrollOffset: effectiveOffset, viewportHeight };
  }, [effectiveOffset, viewportHeight, overscan, totalLines, contentHeight]);

  // ── Helper: content-space Y position for item at `index` (virtualized) ──
  // Includes padding — content row 0 is the first row of padding,
  // first item is at contentPadTop.
  const getItemContentTop = useCallback((index: number): number => {
    let top = contentPadTop;
    for (let i = 0; i < index && i < childArray.length; i++) {
      top += measuredHeightsRef.current.get(i) ?? estimatedItemHeight;
    }
    return top;
  }, [childArray.length, estimatedItemHeight, contentPadTop]);

  const getItemContentTopRef = useRef(getItemContentTop);
  getItemContentTopRef.current = getItemContentTop;

  // ── Keep a ref to isArrayVirtualized for stable closure capture ──
  const isArrayVirtualizedRef = useRef(isArrayVirtualized);
  isArrayVirtualizedRef.current = isArrayVirtualized;

  // ── scrollToNodeRef ──────────────────────────────────────────────
  // Shared scroll-to-node function for public scrollTo, follow-focus,
  // and useScrollIntoView.
  //
  // Non-virtualized: walks the Yoga tree from the node up to the
  // content box, accumulating getComputedLayout().top.  Always
  // accurate because Yoga positions are fresh after calculateLayout().
  //
  // Virtualized: uses the measured-heights map (off-screen items
  // aren't mounted, so Yoga positions aren't available for them).
  const scrollToNodeRef = useRef<(node: GlyphNode, options?: ScrollIntoViewOptions) => void>(() => {});
  scrollToNodeRef.current = (node: GlyphNode, options?: ScrollIntoViewOptions) => {
    const block = options?.block ?? "nearest";

    let elementTop: number;
    let nodeHeight: number;

    if (isArrayVirtualizedRef.current) {
      // ── Virtualized: heights map ──
      let itemIndex = -1;
      for (const [idx, itemNode] of itemRefsRef.current) {
        if (itemNode === node || isDescendantOf(node, itemNode)) {
          itemIndex = idx;
          break;
        }
      }

      if (itemIndex >= 0) {
        elementTop = getItemContentTopRef.current(itemIndex);
        nodeHeight = measuredHeightsRef.current.get(itemIndex) ?? estimatedItemHeight;
      } else {
        return;
      }
    } else {
      // ── Non-virtualized: Yoga walk-up ──
      // Walk from the focused node to the content box, summing
      // getComputedLayout().top at each level.  Result is the
      // node's position relative to the content box's border box
      // (i.e., padding is already included).
      if (!contentRef.current) return;

      const targetYn = node.yogaNode;
      nodeHeight = targetYn ? (targetYn.getComputedLayout().height || 1) : (node.layout.height || 1);

      let top = 0;
      let cur: GlyphNode | null = node;
      while (cur && cur !== contentRef.current) {
        const yn = cur.yogaNode;
        if (yn) top += yn.getComputedLayout().top;
        cur = cur.parent;
      }
      if (!cur) return; // node is not inside the content box

      elementTop = top;
    }

    const elementBottom = elementTop + nodeHeight;
    const curOffset = offsetRef.current;
    const vpHeight = viewportHeightRef.current;

    switch (block) {
      case "start":
        setOffsetRef.current(elementTop);
        break;
      case "center":
        setOffsetRef.current(elementTop - Math.floor((vpHeight - nodeHeight) / 2));
        break;
      case "end":
        setOffsetRef.current(elementBottom - vpHeight);
        break;
      case "nearest":
      default: {
        if (elementTop < curOffset) {
          setOffsetRef.current(elementTop);
        } else if (elementBottom > curOffset + vpHeight) {
          setOffsetRef.current(elementBottom - vpHeight);
        }
        break;
      }
    }
  };

  // ── scrollToIndex ────────────────────────────────────────────────
  // Scroll to an item by array index.
  // Non-virtualized: reads Yoga position from the wrapper node.
  // Virtualized: computes from the heights map.
  const scrollToIndexRef = useRef<(index: number, options?: ScrollIntoViewOptions) => void>(() => {});
  scrollToIndexRef.current = (index: number, options?: ScrollIntoViewOptions) => {
    if (index < 0 || index >= childArray.length) return;
    const block = options?.block ?? "nearest";

    let elementTop: number;
    let nodeHeight: number;

    if (isArrayVirtualizedRef.current) {
      elementTop = getItemContentTopRef.current(index);
      nodeHeight = measuredHeightsRef.current.get(index) ?? estimatedItemHeight;
    } else {
      // Non-virtualized: all children are mounted — use Yoga position
      const wrapperNode = itemRefsRef.current.get(index);
      if (!wrapperNode?.yogaNode) return;
      const cl = wrapperNode.yogaNode.getComputedLayout();
      elementTop = cl.top;
      nodeHeight = cl.height || 1;
    }

    const elementBottom = elementTop + nodeHeight;
    const curOffset = offsetRef.current;
    const vpHeight = viewportHeightRef.current;

    switch (block) {
      case "start":
        setOffsetRef.current(elementTop);
        break;
      case "center":
        setOffsetRef.current(elementTop - Math.floor((vpHeight - nodeHeight) / 2));
        break;
      case "end":
        setOffsetRef.current(elementBottom - vpHeight);
        break;
      case "nearest":
      default:
        if (elementTop < curOffset) setOffsetRef.current(elementTop);
        else if (elementBottom > curOffset + vpHeight) setOffsetRef.current(elementBottom - vpHeight);
        break;
    }
  };

  // ── Pending focus (virtualized only) ────────────────────────────
  // When Tab scrolls to an off-screen item, we store the target
  // index here.  After the next render the item mounts + registers
  // with the focus system, and the effect below focuses it.
  const pendingFocusIndexRef = useRef<number | null>(null);

  // ── Imperative handle (for external callers via ref) ──
  useImperativeHandle(ref, () => ({
    scrollToIndex(index: number, options?: ScrollIntoViewOptions) {
      scrollToIndexRef.current(index, options);
    },
    scrollTo(node: GlyphNode, options?: ScrollIntoViewOptions) {
      scrollToNodeRef.current(node, options);
    },
  }));

  // ── ScrollView context ──
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
    scrollTo: (node: GlyphNode, opts?: ScrollIntoViewOptions): void => {
      scrollToNodeRef.current(node, opts);
    },
    scrollToIndex: (index: number, opts?: ScrollIntoViewOptions): void => {
      scrollToIndexRef.current(index, opts);
    },
  }), [viewportLayout.y, viewportHeight, effectiveOffset]);

  // Keep WeakMap fresh for useScrollIntoView parent-chain lookups
  useEffect(() => {
    if (contentRef.current) {
      nodeScrollContextMap.set(contentRef.current, scrollViewContextValue);
    }
  }, [scrollViewContextValue]);

  // ── Re-clamp when content/viewport changes ──
  useEffect(() => {
    if (offset > maxOffset && maxOffset >= 0) {
      setOffset(maxOffset);
    }
  }, [offset, maxOffset, setOffset]);

  // ── Follow-focus ──
  // When focus moves to a child, scroll to keep it in view.
  useEffect(() => {
    if (!scrollToFocus || !focusCtx || !contentRef.current) return;

    const unsubscribe = focusCtx.onFocusChange((focusedId) => {
      if (!focusedId || !contentRef.current) return;

      const focusedNode = findFocusIdInTree(contentRef.current, focusedId);
      if (!focusedNode) return;

      scrollToNodeRef.current(focusedNode, { block: "nearest" });
    });

    return unsubscribe;
  }, [scrollToFocus, focusCtx]);

  // ── Priority Tab handler (virtualized only) ─────────────────────
  // Owns Tab/Shift+Tab when focus is inside this ScrollView.
  // Needed because with the sliding window, dynamically mounted items
  // register at the END of the global focus order — breaking visual
  // Tab navigation.  By consuming Tab here we guarantee index-order
  // navigation and scroll to reveal off-screen items.
  //
  // In non-virtualized mode all children are mounted and registered
  // in the correct order, so the default focus system handles Tab.
  useEffect(() => {
    if (!isArrayVirtualized || !scrollToFocus || !inputCtx || !focusCtx) return;

    const handler = (key: Key): boolean => {
      if (key.name !== "tab" || key.ctrl || key.alt) return false;

      const fid = focusCtx.focusedId;
      if (!fid) return false;
      if (!contentRef.current) return false;
      if (!findFocusIdInTree(contentRef.current, fid)) return false;

      let currentIdx = -1;
      for (const [idx, node] of itemRefsRef.current) {
        if (hasFocusId(node, fid)) {
          currentIdx = idx;
          break;
        }
      }
      if (currentIdx < 0) return false;

      const nextIdx = key.shift ? currentIdx - 1 : currentIdx + 1;
      if (nextIdx < 0 || nextIdx >= childArray.length) return false;

      scrollToIndexRef.current(nextIdx, { block: "nearest" });

      const nextNode = itemRefsRef.current.get(nextIdx);
      if (nextNode) {
        const targetId = findFirstFocusId(nextNode);
        if (targetId) focusCtx.requestFocus(targetId);
      } else {
        pendingFocusIndexRef.current = nextIdx;
      }

      return true;
    };

    return inputCtx.subscribePriority(handler);
  }, [isArrayVirtualized, scrollToFocus, inputCtx, focusCtx, childArray.length]);

  // ── Resolve pending focus after mount (virtualized only) ──
  useEffect(() => {
    if (!isArrayVirtualized) return;
    const idx = pendingFocusIndexRef.current;
    if (idx === null || !focusCtx) return;

    const node = itemRefsRef.current.get(idx);
    if (!node) return;

    const targetFocusId = findFirstFocusId(node);
    if (targetFocusId) {
      focusCtx.requestFocus(targetFocusId);
    }
    pendingFocusIndexRef.current = null;
  });

  // ── Keyboard ──
  const containsFocus = useCallback((): boolean => {
    if (!focusCtx) return false;
    const currentFocusId = focusCtx.focusedId;
    if (!currentFocusId) return false;
    if (focusable && focusId && currentFocusId === focusId) return true;
    if (!contentRef.current) return false;
    const find = (node: GlyphNode): boolean => {
      if (node.focusId === currentFocusId) return true;
      for (const child of node.children) {
        if (find(child)) return true;
      }
      return false;
    };
    return find(contentRef.current);
  }, [focusCtx, focusable, focusId]);

  useInput((key: Key) => {
    if (disableKeyboard) return;
    if (!containsFocus()) return;

    const halfPage = Math.max(1, Math.floor(viewportHeight / 2));
    const fullPage = Math.max(1, viewportHeight);

    switch (key.name) {
      case "pageup":
        setOffset(offset - fullPage);
        break;
      case "pagedown":
        setOffset(offset + fullPage);
        break;
      default:
        if (key.ctrl) {
          if (key.name === "d") setOffset(offset + halfPage);
          else if (key.name === "u") setOffset(offset - halfPage);
          else if (key.name === "f") setOffset(offset + fullPage);
          else if (key.name === "b") setOffset(offset - fullPage);
        }
        break;
    }
  }, [offset, scrollStep, viewportHeight, maxOffset, disableKeyboard, setOffset, containsFocus]);

  // ── Padding extraction ──
  // Padding lives on the inner content wrapper (same as before) so
  // the clip region on the outer box aligns with the border edge.
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

  // ── Intrinsic height ──
  const hasBorder = styleRest.border != null && styleRest.border !== "none";
  const borderHeight = hasBorder ? 2 : 0;
  const intrinsicHeight = contentHeight > 0 ? contentHeight + borderHeight : undefined;

  const useIntrinsicHeight =
    styleRest.height === undefined &&
    intrinsicHeight !== undefined &&
    !styleRest.flexGrow;

  const outerStyle: Style = {
    ...styleRest,
    ...(isSelfFocused ? focusedStyle : {}),
    clip: true,
    ...(useIntrinsicHeight
      ? {
          height: intrinsicHeight,
          flexShrink: styleRest.flexShrink ?? 1,
          minHeight: styleRest.minHeight ?? 0,
        }
      : {}),
  };

  // ── Content wrapper style ──
  // position: absolute so it does NOT push the outer box's auto-height.
  //
  // Non-virtualized: top = -effectiveOffset (classic browser-like scroll).
  // Virtualized: top = startOffset - effectiveOffset - contentPadTop.
  const contentTop = isArrayVirtualized
    ? (visibility.startOffset - effectiveOffset - contentPadTop)
    : isLineVirtualized
      ? -(effectiveOffset - visibleRange.start)
      : -effectiveOffset;

  const paddingProps = {
    ...(_pad !== undefined && { padding: _pad }),
    ...(_px !== undefined && { paddingX: _px }),
    ...(_py !== undefined && { paddingY: _py }),
    ...(_pt !== undefined && { paddingTop: _pt }),
    ...(_pr !== undefined && { paddingRight: _pr }),
    ...(_pb !== undefined && { paddingBottom: _pb }),
    ...(_pl !== undefined && { paddingLeft: _pl }),
  };

  // ── Rendered children ──
  const renderedChildren: ReactNode = isLineVirtualized
    ? (children as (range: VisibleRange) => ReactNode)(visibleRange)
    : isArrayVirtualized
      // Virtualized: only mount visible slice
      ? childArray.slice(visibility.startIndex, visibility.endIndex).map((child, i) => {
          const actualIndex = visibility.startIndex + i;
          return React.createElement(
            "box" as any,
            {
              key: actualIndex,
              ref: (node: GlyphNode | null) => {
                if (node) itemRefsRef.current.set(actualIndex, node);
                else itemRefsRef.current.delete(actualIndex);
              },
            },
            child,
          );
        })
      : isArrayMode
        // Non-virtualized: mount ALL children, wrapped for ref tracking
        ? childArray.map((child, i) =>
            React.createElement(
              "box" as any,
              {
                key: i,
                ref: (node: GlyphNode | null) => {
                  if (node) itemRefsRef.current.set(i, node);
                  else itemRefsRef.current.delete(i);
                },
              },
              child,
            ),
          )
        : (children as ReactNode);

  // ── Measure item heights after render (virtualized only) ──
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

    if (needsUpdate) {
      forceUpdate((n) => n + 1);
    }
  });

  // ── Scrollbar ──
  const isScrollable = contentHeight > viewportHeight && viewportHeight > 0;
  const scrollbarVisible = showScrollbar && isScrollable;

  const thumbHeight = Math.max(1, Math.floor((viewportHeight / contentHeight) * viewportHeight));
  const scrollableRange = contentHeight - viewportHeight;
  const thumbPosition = scrollableRange > 0
    ? Math.floor((effectiveOffset / scrollableRange) * (viewportHeight - thumbHeight))
    : 0;

  const scrollbarChars: string[] = [];
  if (scrollbarVisible) {
    for (let i = 0; i < viewportHeight; i++) {
      scrollbarChars.push(i >= thumbPosition && i < thumbPosition + thumbHeight ? "█" : "░");
    }
  }

  const scrollbarStyle: Style = {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 1,
    height: viewportHeight,
    flexDirection: "column" as const,
  };

  // ── Render tree ──
  return React.createElement(
    ScrollViewContext.Provider,
    { value: scrollViewContextValue },
    React.createElement(
      "box" as any,
      {
        style: outerStyle,
        ref: (node: any) => { viewportRef.current = node ?? null; },
        ...(focusable ? { focusable: true, focusId } : {}),
      },
      // Content wrapper — absolute so it doesn't push the outer box's height.
      React.createElement(
        "box" as any,
        {
          style: {
            position: "absolute" as const,
            top: contentTop,
            left: 0,
            right: 0,
            flexDirection: "column" as const,
            ...paddingProps,
            // Reserve space for scrollbar
            paddingRight: scrollbarVisible
              ? ((paddingProps.paddingRight ?? 0) as number) + 1
              : paddingProps.paddingRight,
          },
          ref: (node: any) => {
            contentRef.current = node ?? null;
            if (node) {
              nodeScrollContextMap.set(node, scrollViewContextValue);
            }
          },
        },
        renderedChildren,
      ),
      // Scrollbar overlay
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
});

// ── Helpers ──

/** Check if `node` is a descendant of `ancestor`. */
function isDescendantOf(node: GlyphNode, ancestor: GlyphNode): boolean {
  let cur: GlyphNode | null = node;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

/** Walk `root` to find the GlyphNode whose `focusId` matches. */
function findFocusIdInTree(root: GlyphNode, focusId: string): GlyphNode | null {
  if (root.focusId === focusId) return root;
  for (const child of root.children) {
    const found = findFocusIdInTree(child, focusId);
    if (found) return found;
  }
  return null;
}

/** Check whether `focusId` exists anywhere in `node`'s subtree. */
function hasFocusId(node: GlyphNode, focusId: string): boolean {
  if (node.focusId === focusId) return true;
  for (const child of node.children) {
    if (hasFocusId(child, focusId)) return true;
  }
  return false;
}

/** Find the first `focusId` in `node`'s subtree (depth-first). */
function findFirstFocusId(node: GlyphNode): string | null {
  if (node.focusId) return node.focusId;
  for (const child of node.children) {
    const found = findFirstFocusId(child);
    if (found) return found;
  }
  return null;
}
