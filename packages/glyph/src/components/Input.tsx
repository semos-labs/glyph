import React, { useState, useContext, useEffect, useRef } from "react";
import type { Style, Key } from "../types/index.js";
import { InputContext, FocusContext } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: Style;
}

export function Input(props: InputProps): React.JSX.Element {
  const { value: controlledValue, defaultValue = "", onChange, placeholder, style } = props;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [cursorPos, setCursorPos] = useState(defaultValue.length);
  const inputCtx = useContext(InputContext);
  const focusCtx = useContext(FocusContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Keep a ref to current value/cursor so the handler closure always reads fresh values
  const stateRef = useRef({ value, cursorPos, isControlled, onChange });
  stateRef.current = { value, cursorPos, isControlled, onChange };

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx]);

  // Register focused input handler - returns true for consumed keys
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      const { value: val, cursorPos: pos, isControlled: ctrl, onChange: cb } = stateRef.current;

      // Pass through escape/return - let useInput handlers see them
      if (key.name === "escape" || key.name === "return") return false;

      // Ctrl shortcuts consumed by the input
      if (key.ctrl) {
        if (key.name === "w") {
          // Delete word backward
          if (pos > 0) {
            let i = pos;
            while (i > 0 && val[i - 1] === " ") i--;
            while (i > 0 && val[i - 1] !== " ") i--;
            const newVal = val.slice(0, i) + val.slice(pos);
            if (!ctrl) setInternalValue(newVal);
            cb?.(newVal);
            setCursorPos(i);
          }
          return true;
        }
        if (key.name === "a") { setCursorPos(0); return true; }
        if (key.name === "e") { setCursorPos(val.length); return true; }
        if (key.name === "u") {
          // Delete from cursor to start
          if (pos > 0) {
            const newVal = val.slice(pos);
            if (!ctrl) setInternalValue(newVal);
            cb?.(newVal);
            setCursorPos(0);
          }
          return true;
        }
        if (key.name === "k") {
          // Delete from cursor to end
          if (pos < val.length) {
            const newVal = val.slice(0, pos);
            if (!ctrl) setInternalValue(newVal);
            cb?.(newVal);
          }
          return true;
        }
        // All other ctrl combos pass through to useInput
        return false;
      }

      // Pass through alt combos to useInput
      if (key.alt) return false;

      if (key.name === "left") {
        setCursorPos((p) => Math.max(0, p - 1));
        return true;
      }
      if (key.name === "right") {
        setCursorPos((p) => Math.min(val.length, p + 1));
        return true;
      }
      if (key.name === "home") {
        setCursorPos(0);
        return true;
      }
      if (key.name === "end") {
        setCursorPos(val.length);
        return true;
      }
      if (key.name === "backspace") {
        if (pos > 0) {
          const newVal = val.slice(0, pos - 1) + val.slice(pos);
          if (!ctrl) setInternalValue(newVal);
          cb?.(newVal);
          setCursorPos((p) => Math.max(0, p - 1));
        }
        return true;
      }
      if (key.name === "delete") {
        if (pos < val.length) {
          const newVal = val.slice(0, pos) + val.slice(pos + 1);
          if (!ctrl) setInternalValue(newVal);
          cb?.(newVal);
        }
        return true;
      }

      // Special/function keys we don't handle - pass through
      if (key.name.length > 1) return false;

      // Printable character - consume it
      const ch = key.sequence;
      if (ch.length === 1 && ch.charCodeAt(0) >= 32) {
        const newVal = val.slice(0, pos) + ch + val.slice(pos);
        if (!ctrl) setInternalValue(newVal);
        cb?.(newVal);
        setCursorPos((p) => p + 1);
        return true;
      }

      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx]);

  return React.createElement("input" as any, {
    style,
    value,
    defaultValue,
    placeholder,
    onChange,
    cursorPosition: cursorPos,
    ref: (node: any) => {
      if (node) {
        nodeRef.current = node;
        focusIdRef.current = node.focusId;
      }
    },
  });
}
