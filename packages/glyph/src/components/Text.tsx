import React, { forwardRef, useContext, useEffect, useRef, useState } from "react";
import type { Style } from "../types/index.js";
import type { ReactNode } from "react";
import type { GlyphNode } from "../reconciler/nodes.js";
import { FocusContext } from "../hooks/context.js";

export interface TextProps {
  style?: Style;
  children?: ReactNode;
  wrap?: Style["wrap"];
  focusable?: boolean;
  focusedStyle?: Style;
}

export const Text = forwardRef<GlyphNode, TextProps>(
  function Text({ children, style, wrap, focusable, focusedStyle }, ref): React.JSX.Element {
    const focusCtx = useContext(FocusContext);
    const nodeRef = useRef<GlyphNode | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Track focus state
    useEffect(() => {
      if (!focusCtx || !focusable || !nodeRef.current?.focusId) return;
      const fid = nodeRef.current.focusId;
      setIsFocused(focusCtx.focusedId === fid);
      return focusCtx.onFocusChange((newId) => {
        setIsFocused(newId === fid);
      });
    }, [focusCtx, focusable]);

    // Merge styles
    let mergedStyle = wrap ? { ...style, wrap } : style;
    if (isFocused && focusedStyle) {
      mergedStyle = { ...mergedStyle, ...focusedStyle };
    }

    // Combine refs
    const setRef = (node: GlyphNode | null) => {
      nodeRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return React.createElement("text" as any, { style: mergedStyle, focusable, ref: setRef }, children);
  }
);
