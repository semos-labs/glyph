import React, { useState, useContext, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import type { Style, Key, InputHandle } from "../types/index.js";
import { InputContext, FocusContext, LayoutContext, ScrollViewContext } from "../hooks/context.js";
import type { ScrollIntoViewOptions } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { wrapLines } from "../layout/textMeasure.js";

// ── Visual line helpers (accounts for word wrapping) ──────────

interface VisualLineInfo {
  visualLine: number;
  visualCol: number;
  totalVisualLines: number;
  /** Character offset where current visual line starts in original text
 */
  lineStartOffset: number;
  /** Length of current visual line */
  lineLength: number;
}

/**
 * Convert flat cursor position → visual (wrapped) line/col.
 * This accounts for soft wrapping based on width.
 */
function cursorToVisualLine(
  text: string,
  pos: number,
  width: number,
): VisualLineInfo {
  if (width <= 0) {
    return { visualLine: 0, visualCol: pos, totalVisualLines: 1, lineStartOffset: 0, lineLength: text.length };
  }
  
  const logicalLines = text.split("\n");
  const allVisualLines: { text: string; logicalOffset: number }[] = [];
  
  let logicalOffset = 0;
  for (const logicalLine of logicalLines) {
    const wrapped = wrapLines([logicalLine], width, "wrap");
    let offsetInLogical = 0;
    for (const wrappedLine of wrapped) {
      allVisualLines.push({ 
        text: wrappedLine, 
        logicalOffset: logicalOffset + offsetInLogical 
      });
      offsetInLogical += wrappedLine.length;
    }
    logicalOffset += logicalLine.length + 1; // +1 for newline
  }
  
  // Find which visual line contains the cursor
  let charCount = 0;
  for (let i = 0; i < allVisualLines.length; i++) {
    const vl = allVisualLines[i]!;
    const lineLen = vl.text.length;
    // Account for newline at end of logical lines (except last)
    const isEndOfLogicalLine = i + 1 < allVisualLines.length && 
      allVisualLines[i + 1]!.logicalOffset !== vl.logicalOffset + lineLen;
    const effectiveLen = lineLen + (isEndOfLogicalLine ? 1 : 0);
    
    // Use < instead of <= so cursor at wrap boundary belongs to the NEXT line
    // Exception: last line always captures remaining positions
    if (pos < charCount + lineLen || i === allVisualLines.length - 1) {
      return {
        visualLine: i,
        visualCol: Math.min(pos - charCount, lineLen),
        totalVisualLines: allVisualLines.length,
        lineStartOffset: charCount,
        lineLength: lineLen,
      };
    }
    charCount += effectiveLen;
  }
  
  // Fallback
  const lastIdx = allVisualLines.length - 1;
  return {
    visualLine: lastIdx,
    visualCol: allVisualLines[lastIdx]!.text.length,
    totalVisualLines: allVisualLines.length,
    lineStartOffset: charCount - allVisualLines[lastIdx]!.text.length,
    lineLength: allVisualLines[lastIdx]!.text.length,
  };
}

/**
 * Convert visual (wrapped) line/col → flat cursor position.
 */
function visualLineToCursor(
  text: string,
  visualLine: number,
  visualCol: number,
  width: number,
): number {
  if (width <= 0) {
    return Math.min(visualCol, text.length);
  }
  
  const logicalLines = text.split("\n");
  const allVisualLines: { text: string; startOffset: number }[] = [];
  
  let offset = 0;
  for (const logicalLine of logicalLines) {
    const wrapped = wrapLines([logicalLine], width, "wrap");
    let offsetInLogical = 0;
    for (const wrappedLine of wrapped) {
      allVisualLines.push({ 
        text: wrappedLine, 
        startOffset: offset + offsetInLogical 
      });
      offsetInLogical += wrappedLine.length;
    }
    offset += logicalLine.length + 1;
  }
  
  const targetLine = Math.max(0, Math.min(visualLine, allVisualLines.length - 1));
  const vl = allVisualLines[targetLine]!;
  const col = Math.min(visualCol, vl.text.length);
  
  return vl.startOffset + col;
}

// ── Logical line helpers (for Ctrl+A/E/U/K, Home/End) ─────────

/** Convert flat cursor position → (line, col) within newline-separated text. */
function cursorToLineCol(
  text: string,
  pos: number,
): { line: number; col: number; lines: string[] } {
  const lines = text.split("\n");
  let remaining = pos;
  for (let i = 0; i < lines.length; i++) {
    if (remaining <= lines[i]!.length) {
      return { line: i, col: remaining, lines };
    }
    remaining -= lines[i]!.length + 1;
  }
  const last = lines.length - 1;
  return { line: last, col: lines[last]!.length, lines };
}

/** Convert (line, col) → flat cursor position. */
function lineColToCursor(
  lines: string[],
  line: number,
  col: number,
): number {
  let pos = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    pos += lines[i]!.length + 1;
  }
  return pos + Math.min(col, lines[line]?.length ?? 0);
}

// ── Component ─────────────────────────────────────────────────

/** Input type for value validation. */
export type InputType = "text" | "number";

/**
 * Props for the {@link Input} component.
 */
export interface InputProps {
  /** Controlled value. Pair with `onChange` to manage state externally. */
  value?: string;
  /** Initial value for uncontrolled mode (ignored when `value` is provided). */
  defaultValue?: string;
  /** Callback fired whenever the text value changes. */
  onChange?: (value: string) => void;
  /** Called on every key press. Return `true` to prevent default handling. */
  onKeyPress?: (key: Key) => boolean | void;
  /** 
   * Called before a value change is applied. Useful for input masking/validation.
   * @param newValue - The proposed new value
   * @param oldValue - The current value
   * @returns 
   *   - `string` to use a different value (and cursor moves to end of returned string)
   *   - `false` to reject the change entirely
   *   - `undefined` to accept the change as-is
   */
  onBeforeChange?: (newValue: string, oldValue: string) => string | false | void;
  /** Text shown when the input is empty. */
  placeholder?: string;
  /** Base style for the input container. */
  style?: Style;
  /** Style when focused (merged with style). */
  focusedStyle?: Style;
  /** Enable multiline editing (Enter inserts newlines, Up/Down navigate lines). */
  multiline?: boolean;
  /** Automatically focus this input when mounted. */
  autoFocus?: boolean;
  /** 
   * Input type for validation:
   * - "text" (default): accepts any character
   * - "number": only accepts digits, decimal point, and minus sign
   */
  type?: InputType;
}

/**
 * Text input with full keyboard editing, cursor navigation, and optional masking.
 *
 * Supports both controlled (`value` + `onChange`) and uncontrolled (`defaultValue`)
 * modes. Multiline editing is opt-in via the `multiline` prop.
 *
 * **Keyboard shortcuts** (when focused):
 * | Key | Action |
 * |---|---|
 * | ← / → | Move cursor |
 * | Home / End | Start / end of line |
 * | Ctrl+A / Ctrl+E | Start / end of line |
 * | Ctrl+W | Delete word backward |
 * | Ctrl+K | Delete to end of line |
 * | Alt+← / Alt+→ | Move by word |
 * | Alt+Backspace | Delete word backward |
 * | Up / Down | Navigate visual lines (multiline / wrapped) |
 *
 * @example
 * ```tsx
 * const [name, setName] = useState("");
 *
 * <Input
 *   value={name}
 *   onChange={setName}
 *   placeholder="Your name"
 *   style={{ border: "round", paddingX: 1 }}
 *   focusedStyle={{ borderColor: "cyan" }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Masked phone input
 * import { masks } from "@semos-labs/glyph";
 *
 * <Input
 *   value={phone}
 *   onChange={setPhone}
 *   onBeforeChange={masks.usPhone}
 *   placeholder="(555) 555-5555"
 * />
 * ```
  * @category Form
 */
export const Input = forwardRef<InputHandle, InputProps>(
  function Input(props, ref) {
  const {
    value: controlledValue,
    defaultValue = "",
    onChange,
    onKeyPress,
    onBeforeChange,
    placeholder,
    style,
    focusedStyle,
    multiline,
    autoFocus,
    type = "text",
  } = props;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [cursorPos, setCursorPos] = useState(defaultValue.length);
  const [innerWidth, setInnerWidth] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  // Track when node is mounted with a valid focusId
  const [nodeReady, setNodeReady] = useState(false);
  const inputCtx = useContext(InputContext);
  const focusCtx = useContext(FocusContext);
  const layoutCtx = useContext(LayoutContext);
  const scrollCtx = useContext(ScrollViewContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

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
    get value() {
      return workingValueRef.current;
    },
    scrollIntoView(opts?: ScrollIntoViewOptions) {
      if (scrollCtx && nodeRef.current) scrollCtx.scrollTo(nodeRef.current, opts);
    },
  }), [focusCtx, isFocused, scrollCtx]);

  // Subscribe to layout changes to get innerWidth for visual line navigation
  useEffect(() => {
    if (!layoutCtx || !nodeRef.current) return;
    const layout = layoutCtx.getLayout(nodeRef.current);
    setInnerWidth((prev) => prev === layout.innerWidth ? prev : layout.innerWidth);
    return layoutCtx.subscribe(nodeRef.current, (rect) => {
      setInnerWidth((prev) => prev === rect.innerWidth ? prev : rect.innerWidth);
    });
  }, [layoutCtx]);

  // Keep working value/cursor in refs that update SYNCHRONOUSLY 
  // This prevents race conditions when typing faster than React renders
  const workingValueRef = useRef(value);
  const workingCursorRef = useRef(cursorPos);
  // Track what we last sent to detect external vs echoed changes
  const lastSentValueRef = useRef(value);
  const lastSentCursorRef = useRef(cursorPos);
  
  // Sync refs with React state when it updates
  // Only update if the incoming value is an EXTERNAL change (not just echoing what we sent)
  // This prevents overwriting working refs during fast typing
  useEffect(() => {
    // Only accept the incoming value if it's different from what we last sent
    // This means it's either an external change or a transformed value from the parent
    if (value !== lastSentValueRef.current) {
      workingValueRef.current = value;
      lastSentValueRef.current = value;
      // Move cursor to end of new value for programmatic changes
      workingCursorRef.current = value.length;
      lastSentCursorRef.current = value.length;
      setCursorPos(value.length);
    }
  }, [value]);
  
  // Same logic for cursor - only accept external changes
  useEffect(() => {
    if (cursorPos !== lastSentCursorRef.current) {
      workingCursorRef.current = cursorPos;
      lastSentCursorRef.current = cursorPos;
    }
  }, [cursorPos]);

  // Keep a ref to current values so the handler closure always reads fresh state
  const stateRef = useRef({
    isControlled,
    onChange,
    onKeyPress,
    onBeforeChange,
    multiline: multiline ?? false,
    innerWidth,
    type,
  });
  stateRef.current = {
    isControlled,
    onChange,
    onKeyPress,
    onBeforeChange,
    multiline: multiline ?? false,
    innerWidth,
    type,
  };

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx, nodeReady]);

  // Auto-focus on mount if requested
  // Use setTimeout to ensure this runs AFTER all registrations and layout effects complete
  const autoFocusedRef = useRef(false);
  useEffect(() => {
    // Reset the flag when node is not ready (component unmounted/remounting)
    if (!nodeReady) {
      autoFocusedRef.current = false;
      return;
    }
    
    if (autoFocus && !autoFocusedRef.current && focusCtx && focusIdRef.current) {
      autoFocusedRef.current = true;
      const fid = focusIdRef.current;
      // Use setTimeout(0) instead of queueMicrotask for more reliable timing
      // This ensures registration has fully propagated through the focus system
      const timer = setTimeout(() => {
        focusCtx.requestFocus(fid);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, focusCtx, nodeReady]);

  // Subscribe to focus changes for reactive visual state
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx, nodeReady]);

  // Register focused input handler - returns true for consumed keys
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      const {
        isControlled: ctrl,
        onChange: cb,
        onKeyPress: onKey,
        onBeforeChange: onBefore,
        multiline: ml,
      } = stateRef.current;
      
      // Call onKeyPress callback first - if it returns true, prevent default handling
      if (onKey?.(key) === true) {
        return true;
      }
      
      // Read from working refs (updated synchronously) to handle fast typing
      const val = workingValueRef.current;
      const pos = workingCursorRef.current;

      // Escape always passes through
      if (key.name === "escape") return false;

      // Helper to update value and cursor synchronously
      // Calls onBeforeChange if provided, allowing masking/validation
      const updateValue = (newVal: string, newCursor: number) => {
        let finalVal = newVal;
        let finalCursor = newCursor;
        
        if (onBefore) {
          const result = onBefore(newVal, val);
          if (result === false) {
            // Reject the change entirely
            return;
          }
          if (typeof result === "string") {
            // Use the modified value, cursor goes to end
            finalVal = result;
            finalCursor = result.length;
          }
        }
        
        workingValueRef.current = finalVal;
        workingCursorRef.current = finalCursor;
        lastSentValueRef.current = finalVal; // Track what we're sending
        lastSentCursorRef.current = finalCursor;
        if (!ctrl) setInternalValue(finalVal);
        cb?.(finalVal);
        setCursorPos(finalCursor);
      };
      
      const updateCursor = (newCursor: number) => {
        workingCursorRef.current = newCursor;
        lastSentCursorRef.current = newCursor; // Track what we're sending
        setCursorPos(newCursor);
      };

      // Return: pass through for single-line, insert newline for multiline
      if (key.name === "return") {
        if (ml) {
          const newVal = val.slice(0, pos) + "\n" + val.slice(pos);
          updateValue(newVal, pos + 1);
          return true;
        }
        return false;
      }

      // Ctrl shortcuts consumed by the input
      if (key.ctrl) {
        if (key.name === "w") {
          // Delete word backward (stops at newline in multiline)
          if (pos > 0) {
            let i = pos;
            while (i > 0 && val[i - 1] === " ") i--;
            while (
              i > 0 &&
              val[i - 1] !== " " &&
              (!ml || val[i - 1] !== "\n")
            )
              i--;
            const newVal = val.slice(0, i) + val.slice(pos);
            updateValue(newVal, i);
          }
          return true;
        }
        if (key.name === "a") {
          if (ml) {
            const { line, lines } = cursorToLineCol(val, pos);
            updateCursor(lineColToCursor(lines, line, 0));
          } else {
            updateCursor(0);
          }
          return true;
        }
        if (key.name === "e") {
          if (ml) {
            const { line, lines } = cursorToLineCol(val, pos);
            updateCursor(lineColToCursor(lines, line, lines[line]!.length));
          } else {
            updateCursor(val.length);
          }
          return true;
        }
        if (key.name === "k") {
          // Delete from cursor to end of line
          if (ml) {
            const { line, lines } = cursorToLineCol(val, pos);
            const lineEnd = lineColToCursor(lines, line, lines[line]!.length);
            if (pos < lineEnd) {
              const newVal = val.slice(0, pos) + val.slice(lineEnd);
              updateValue(newVal, pos);
            }
          } else {
            if (pos < val.length) {
              const newVal = val.slice(0, pos);
              updateValue(newVal, pos);
            }
          }
          return true;
        }
        // All other ctrl combos pass through to useInput
        return false;
      }

      // ── Alt + Arrow: Word navigation ────────────────────────
      if (key.alt) {
        if (key.name === "left" || key.name === "b") {
          // Move to start of previous word
          let i = pos;
          // Skip any spaces before cursor
          while (i > 0 && val[i - 1] === " ") i--;
          // Skip the word
          while (i > 0 && val[i - 1] !== " " && val[i - 1] !== "\n") i--;
          updateCursor(i);
          return true;
        }
        if (key.name === "right" || key.name === "f") {
          // Move to end of next word
          let i = pos;
          // Skip current word
          while (i < val.length && val[i] !== " " && val[i] !== "\n") i++;
          // Skip spaces after word
          while (i < val.length && val[i] === " ") i++;
          updateCursor(i);
          return true;
        }
        if (key.name === "backspace" || key.name === "d") {
          // Delete word backward (Alt+Backspace or Alt+D for forward)
          if (key.name === "backspace") {
            if (pos > 0) {
              let i = pos;
              while (i > 0 && val[i - 1] === " ") i--;
              while (i > 0 && val[i - 1] !== " " && val[i - 1] !== "\n") i--;
              const newVal = val.slice(0, i) + val.slice(pos);
              updateValue(newVal, i);
            }
            return true;
          } else {
            // Alt+D: delete word forward
            if (pos < val.length) {
              let i = pos;
              while (i < val.length && val[i] !== " " && val[i] !== "\n") i++;
              while (i < val.length && val[i] === " ") i++;
              const newVal = val.slice(0, pos) + val.slice(i);
              updateValue(newVal, pos);
            }
            return true;
          }
        }
        // Pass through other alt combos
        return false;
      }

      // ── Navigation ──────────────────────────────────────────

      if (key.name === "left") {
        updateCursor(Math.max(0, pos - 1));
        return true;
      }
      if (key.name === "right") {
        updateCursor(Math.min(val.length, pos + 1));
        return true;
      }
      if (key.name === "up") {
        const { innerWidth: w } = stateRef.current;
        // Use visual line navigation (accounts for word wrapping)
        const info = cursorToVisualLine(val, pos, w);
        if (info.visualLine > 0) {
          updateCursor(visualLineToCursor(val, info.visualLine - 1, info.visualCol, w));
        }
        return true;
      }
      if (key.name === "down") {
        const { innerWidth: w } = stateRef.current;
        // Use visual line navigation (accounts for word wrapping)
        const info = cursorToVisualLine(val, pos, w);
        if (info.visualLine < info.totalVisualLines - 1) {
          updateCursor(visualLineToCursor(val, info.visualLine + 1, info.visualCol, w));
        }
        return true;
      }
      if (key.name === "home") {
        if (ml) {
          const { line, lines } = cursorToLineCol(val, pos);
          updateCursor(lineColToCursor(lines, line, 0));
        } else {
          updateCursor(0);
        }
        return true;
      }
      if (key.name === "end") {
        if (ml) {
          const { line, lines } = cursorToLineCol(val, pos);
          updateCursor(lineColToCursor(lines, line, lines[line]!.length));
        } else {
          updateCursor(val.length);
        }
        return true;
      }

      // ── Editing ─────────────────────────────────────────────

      if (key.name === "backspace") {
        if (pos > 0) {
          const newVal = val.slice(0, pos - 1) + val.slice(pos);
          updateValue(newVal, pos - 1);
        }
        return true;
      }
      if (key.name === "delete") {
        if (pos < val.length) {
          const newVal = val.slice(0, pos) + val.slice(pos + 1);
          updateValue(newVal, pos);
        }
        return true;
      }

      // Space key — treat as printable character
      if (key.name === "space") {
        const newVal = val.slice(0, pos) + " " + val.slice(pos);
        updateValue(newVal, pos + 1);
        return true;
      }

      // Special/function keys we don't handle - pass through
      if (key.name.length > 1) return false;

      // Printable character - consume it
      const ch = key.sequence;
      if (ch.length === 1 && ch.charCodeAt(0) >= 32) {
        // Validate input based on type
        const { type: inputType } = stateRef.current;
        if (inputType === "number") {
          // Only allow digits, decimal point, minus sign (at start)
          const isDigit = /[0-9]/.test(ch);
          const isDecimal = ch === "." && !val.includes(".");
          const isMinus = ch === "-" && pos === 0 && !val.includes("-");
          if (!isDigit && !isDecimal && !isMinus) {
            return true; // Consume but don't insert
          }
        }
        
        const newVal = val.slice(0, pos) + ch + val.slice(pos);
        updateValue(newVal, pos + 1);
        return true;
      }

      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx, nodeReady]);

  // Merge styles based on focus state
  const mergedStyle: Style = {
    ...style,
    ...(isFocused && focusedStyle ? focusedStyle : {}),
  };

  return React.createElement("input" as any, {
    style: mergedStyle,
    value,
    defaultValue,
    placeholder,
    onChange,
    // Use ref (always current) instead of state (can lag during fast typing)
    cursorPosition: workingCursorRef.current,
    multiline: multiline ?? false,
    focused: isFocused,
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
  });
  }
);
