import React, { useRef, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { Style, Key } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { useLayout } from "../hooks/useLayout.js";
import { useInput } from "../hooks/useInput.js";

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
}

export function ScrollView({
  children,
  style,
  scrollOffset: controlledOffset,
  onScroll,
  defaultScrollOffset = 0,
  scrollStep = 1,
  disableKeyboard,
}: ScrollViewProps): React.JSX.Element {
  const isControlled = controlledOffset !== undefined;
  const [internalOffset, setInternalOffset] = useState(defaultScrollOffset);
  const offset = isControlled ? controlledOffset : internalOffset;

  const viewportRef = useRef<GlyphNode | null>(null);
  const contentRef = useRef<GlyphNode | null>(null);
  const viewportLayout = useLayout(viewportRef);
  const contentLayout = useLayout(contentRef);

  const viewportHeight = viewportLayout.innerHeight;
  const contentHeight = contentLayout.height;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);

  // Track last key + timestamp for "gg" detection
  const lastKeyRef = useRef<{ name: string; time: number } | null>(null);

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

  useInput((key: Key) => {
    if (disableKeyboard) return;

    const halfPage = Math.max(1, Math.floor(viewportHeight / 2));

    // Vim "gg" detection: two "g" presses within 500ms
    if (key.sequence === "g" && !key.ctrl && !key.alt) {
      const now = Date.now();
      const last = lastKeyRef.current;
      if (last && last.name === "g" && now - last.time < 500) {
        setOffset(0);
        lastKeyRef.current = null;
        return;
      }
      lastKeyRef.current = { name: "g", time: now };
      return;
    }
    lastKeyRef.current = null;

    switch (key.name) {
      // Arrow keys
      case "up":
        setOffset(offset - scrollStep);
        break;
      case "down":
        setOffset(offset + scrollStep);
        break;
      // Page keys
      case "pageup":
        setOffset(offset - Math.max(1, viewportHeight));
        break;
      case "pagedown":
        setOffset(offset + Math.max(1, viewportHeight));
        break;
      // Home / End
      case "home":
        setOffset(0);
        break;
      case "end":
        setOffset(maxOffset);
        break;
      default:
        // Vim keys
        if (key.sequence === "k") {
          setOffset(offset - scrollStep);
        } else if (key.sequence === "j") {
          setOffset(offset + scrollStep);
        } else if (key.sequence === "G") {
          setOffset(maxOffset);
        } else if (key.name === "d" && key.ctrl) {
          setOffset(offset + halfPage);
        } else if (key.name === "u" && key.ctrl) {
          setOffset(offset - halfPage);
        } else if (key.name === "f" && key.ctrl) {
          setOffset(offset + Math.max(1, viewportHeight));
        } else if (key.name === "b" && key.ctrl) {
          setOffset(offset - Math.max(1, viewportHeight));
        }
        break;
    }
  }, [offset, scrollStep, viewportHeight, maxOffset, disableKeyboard, setOffset]);

  // Outer viewport: user styles + clip. The content is absolutely positioned
  // inside, so it doesn't inflate the viewport's size.
  const outerStyle: Style = {
    ...style,
    clip: true,
  };

  // Inner content: absolutely positioned to fill viewport width,
  // shifted up by scrollOffset. Height is determined by children.
  const innerStyle: Style = {
    position: "absolute" as const,
    top: -offset,
    left: 0,
    right: 0,
    flexDirection: "column" as const,
  };

  return React.createElement(
    "box" as any,
    {
      style: outerStyle,
      ref: (node: any) => {
        viewportRef.current = node ?? null;
      },
    },
    React.createElement(
      "box" as any,
      {
        style: innerStyle,
        ref: (node: any) => {
          contentRef.current = node ?? null;
        },
      },
      children,
    ),
  );
}
