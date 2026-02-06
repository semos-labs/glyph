import React, { useRef, useState, useCallback, useEffect, useContext } from "react";
import type { ReactNode } from "react";
import type { Style, Key } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { useLayout } from "../hooks/useLayout.js";
import { useInput } from "../hooks/useInput.js";
import { FocusContext, LayoutContext } from "../hooks/context.js";

export interface ScrollViewProps {
  children?: ReactNode;
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
}

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
}: ScrollViewProps): React.JSX.Element {
  const isControlled = controlledOffset !== undefined;
  const [internalOffset, setInternalOffset] = useState(defaultScrollOffset);
  const offset = isControlled ? controlledOffset : internalOffset;

  const viewportRef = useRef<GlyphNode | null>(null);
  const contentRef = useRef<GlyphNode | null>(null);
  const viewportLayout = useLayout(viewportRef);
  const contentLayout = useLayout(contentRef);
  
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
  const contentHeight = contentLayout.height;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);

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

  // Outer viewport: user styles (minus padding) + clip.
  // Apply focusedStyle when ScrollView is directly focused.
  const outerStyle: Style = {
    ...styleRest,
    ...(isSelfFocused ? focusedStyle : {}),
    clip: true,
  };

  // Inner content: absolutely positioned to fill viewport width,
  // shifted up by scrollOffset. Padding lives here so text is indented
  // without being clipped.
  const innerStyle: Style = {
    position: "absolute" as const,
    top: -offset,
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

  // Calculate scrollbar dimensions
  const isScrollable = contentHeight > viewportHeight && viewportHeight > 0;
  const scrollbarVisible = showScrollbar && isScrollable;
  
  // Scrollbar thumb size and position
  const thumbHeight = Math.max(1, Math.floor((viewportHeight / contentHeight) * viewportHeight));
  const scrollableRange = contentHeight - viewportHeight;
  const thumbPosition = scrollableRange > 0 
    ? Math.floor((offset / scrollableRange) * (viewportHeight - thumbHeight))
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
    "box" as any,
    {
      style: outerStyle,
      ref: (node: any) => {
        viewportRef.current = node ?? null;
      },
      ...(focusable ? { focusable: true, focusId } : {}),
    },
    // Content
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
      children,
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
  );
}
