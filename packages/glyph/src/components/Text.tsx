import React, { forwardRef, useContext, useEffect, useRef, useState, useImperativeHandle } from "react";
import type { Style, TextHandle } from "../types/index.js";
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

export const Text = forwardRef<TextHandle, TextProps>(
  function Text({ children, style, wrap, focusable, focusedStyle }, ref): React.JSX.Element {
    const focusCtx = useContext(FocusContext);
    const nodeRef = useRef<GlyphNode | null>(null);
    const focusIdRef = useRef<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      focus() {
        if (focusCtx && focusIdRef.current) {
          focusCtx.requestFocus(focusIdRef.current);
        }
      },
      blur() {
        if (focusCtx) {
          focusCtx.blur();
        }
      },
      get isFocused() {
        return isFocused;
      },
    }), [focusCtx, isFocused]);

    // Track focus state
    useEffect(() => {
      if (!focusCtx || !focusable || !focusIdRef.current) return;
      const fid = focusIdRef.current;
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

    // Internal ref callback
    const setRef = (node: GlyphNode | null) => {
      nodeRef.current = node;
      focusIdRef.current = node?.focusId ?? null;
    };

    return React.createElement("text" as any, { style: mergedStyle, focusable, ref: setRef }, children);
  }
);
