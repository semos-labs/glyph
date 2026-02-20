import React, { useContext, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { Style, Key, CheckboxHandle } from "../types/index.js";
import { FocusContext, InputContext, ScrollViewContext } from "../hooks/context.js";
import type { ScrollIntoViewOptions } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

/**
 * Props for the {@link Checkbox} component.
 */
export interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Called when the checkbox is toggled */
  onChange: (checked: boolean) => void;
  /** Label text displayed next to the checkbox */
  label?: string;
  /** Style for the checkbox container */
  style?: Style;
  /** Style when focused */
  focusedStyle?: Style;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Custom character for checked state (default: "✓") */
  checkedChar?: string;
  /** Custom character for unchecked state (default: " ") */
  uncheckedChar?: string;
}

/**
 * Toggle checkbox with label. Activated via Space or Enter.
 *
 * @example
 * ```tsx
 * const [agreed, setAgreed] = useState(false);
 *
 * <Checkbox
 *   checked={agreed}
 *   onChange={setAgreed}
 *   label="I agree to the terms"
 *   focusedStyle={{ bg: "cyan", color: "black" }}
 * />
 * ```
  * @category Form
 */
export const Checkbox = forwardRef<CheckboxHandle, CheckboxProps>(
  function Checkbox({
    checked,
    onChange,
    label,
    style,
    focusedStyle,
    disabled,
    checkedChar = "✓",
    uncheckedChar = " ",
  }, ref) {
    const focusCtx = useContext(FocusContext);
    const inputCtx = useContext(InputContext);
    const scrollCtx = useContext(ScrollViewContext);
    const nodeRef = useRef<GlyphNode | null>(null);
    const focusIdRef = useRef<string | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const checkedRef = useRef(checked);
    checkedRef.current = checked;

    // Track when node is mounted with a valid focusId
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
      get checked() {
        return checkedRef.current;
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

    // Subscribe to focus changes
    useEffect(() => {
      if (!focusCtx || !focusIdRef.current) return;
      const fid = focusIdRef.current;
      setIsFocused(focusCtx.focusedId === fid);
      return focusCtx.onFocusChange((newId) => {
        setIsFocused(newId === fid);
      });
    }, [focusCtx, nodeReady]);

    // Handle space/enter to toggle
    useEffect(() => {
      if (!inputCtx || !focusIdRef.current || disabled) return;
      const fid = focusIdRef.current;

      const handler = (key: Key): boolean => {
        if (focusCtx?.focusedId !== fid) return false;
        if (key.name === "return" || key.name === "space") {
          onChangeRef.current(!checkedRef.current);
          return true;
        }
        return false;
      };

      return inputCtx.registerInputHandler(fid, handler);
    }, [inputCtx, focusCtx, disabled, nodeReady]);

    const mergedStyle: Style = {
      flexDirection: "row",
      gap: 1,
      ...style,
      ...(isFocused && focusedStyle ? focusedStyle : {}),
    };

    const boxChar = checked ? checkedChar : uncheckedChar;
    const boxStyle: Style = {
      color: disabled ? "blackBright" : (isFocused ? "white" : style?.color),
    };
    const labelStyle: Style = {
      color: disabled ? "blackBright" : style?.color,
    };

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
      React.createElement(
        "text" as any,
        { key: "box", style: boxStyle },
        `[${boxChar}]`,
      ),
      label
        ? React.createElement(
            "text" as any,
            { key: "label", style: labelStyle },
            label,
          )
        : null,
    );
  }
);
