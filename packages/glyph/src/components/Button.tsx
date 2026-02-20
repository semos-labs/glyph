import React, { useContext, useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { ReactNode } from "react";
import type { Style, Key, ButtonHandle } from "../types/index.js";
import { FocusContext, InputContext, ScrollViewContext } from "../hooks/context.js";
import type { ScrollIntoViewOptions } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

/**
 * Props for the {@link Button} component.
 */
export interface ButtonProps {
  /** Callback fired when the button is activated (Enter or Space). */
  onPress?: () => void;
  /** Shorthand text label. When provided and `children` is absent, renders the label as text. */
  label?: string;
  /** Base style for the button container. */
  style?: Style;
  /** Style applied when the button is focused (merged with `style`). */
  focusedStyle?: Style;
  /** Custom content. Takes precedence over `label` when both are provided. */
  children?: ReactNode;
  /** When `true`, the button is skipped in the focus order and ignores input. */
  disabled?: boolean;
}

/**
 * Focusable button that triggers an action on Enter or Space.
 *
 * @example
 * ```tsx
 * <Button
 *   label="Save"
 *   onPress={() => save()}
 *   style={{ border: "round", paddingX: 2 }}
 *   focusedStyle={{ bg: "cyan", color: "black" }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Using children for custom content
 * <Button onPress={handleClick}>
 *   <Text style={{ bold: true }}>🚀 Launch</Text>
 * </Button>
 * ```
  * @category Form
 */
export const Button = forwardRef<ButtonHandle, ButtonProps>(
  function Button({ onPress, label, style, focusedStyle, children, disabled }, ref) {
    const focusCtx = useContext(FocusContext);
    const inputCtx = useContext(InputContext);
    const scrollCtx = useContext(ScrollViewContext);
    const nodeRef = useRef<GlyphNode | null>(null);
    const focusIdRef = useRef<string | null>(null);
    const onPressRef = useRef(onPress);
    onPressRef.current = onPress;

    // Track when node is mounted with a valid focusId - this triggers effect re-runs
    const [nodeReady, setNodeReady] = useState(false);
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
      scrollIntoView(opts?: ScrollIntoViewOptions) {
        if (scrollCtx && nodeRef.current) scrollCtx.scrollTo(nodeRef.current, opts);
      },
    }), [focusCtx, isFocused, scrollCtx]);

    // Register with focus system (always register; disabled handled by setSkippable)
    useEffect(() => {
      if (!focusCtx || !focusIdRef.current || !nodeRef.current) return;
      return focusCtx.register(focusIdRef.current, nodeRef.current);
    }, [focusCtx, nodeReady]);

    // Handle disabled state: skip in tab order + release focus if held
    useEffect(() => {
      if (!focusCtx || !focusIdRef.current) return;
      focusCtx.setSkippable(focusIdRef.current, !!disabled);
      if (disabled && focusCtx.focusedId === focusIdRef.current) {
        focusCtx.blur();
      }
    }, [focusCtx, disabled]);

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
        if (key.name === "return" || key.name === "space") {
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

    const content = children ?? (label != null
      ? React.createElement("text" as any, { key: "label" }, label)
      : null);

    return React.createElement(
      "box" as any,
      {
        style: mergedStyle,
        focusable: true,
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
      content,
    );
  }
);
