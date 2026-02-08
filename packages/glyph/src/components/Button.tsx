import React, { useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Style, Key } from "../types/index.js";
import { FocusContext, InputContext } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

export interface ButtonProps {
  onPress?: () => void;
  style?: Style;
  focusedStyle?: Style;
  children?: ReactNode;
  disabled?: boolean;
}

export function Button({
  onPress,
  style,
  focusedStyle,
  children,
  disabled,
}: ButtonProps): React.JSX.Element {
  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  // Track when node is mounted with a valid focusId - this triggers effect re-runs
  const [nodeReady, setNodeReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current || disabled) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx, disabled, nodeReady]);

  // Subscribe to focus changes for reactive visual state
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    // Set initial state
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx, nodeReady]);

  // Handle enter/space when focused
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current || disabled) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      if (focusCtx?.focusedId !== fid) return false;
      if (key.name === "return" || key.name === " " || key.sequence === " ") {
        onPressRef.current?.();
        return true;
      }
      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx, focusCtx, disabled, nodeReady]);

  const mergedStyle: Style = {
    ...style,
    ...(isFocused && focusedStyle ? focusedStyle : {}),
  };

  return React.createElement(
    "box" as any,
    {
      style: mergedStyle,
      focusable: !disabled,
      ref: (node: any) => {
        if (node) {
          nodeRef.current = node;
          focusIdRef.current = node.focusId;
          setNodeReady(true);
        } else {
          nodeRef.current = null;
          focusIdRef.current = null;
          setNodeReady(false);
        }
      },
    },
    children,
  );
}
