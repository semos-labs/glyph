import React, { useState, useContext, useEffect, useRef } from "react";
import type { Style, Key } from "../types/index.js";
import { InputContext, FocusContext, LayoutContext } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { wrapLines } from "../layout/textMeasure.js";

// ── Visual line helpers (accounts for word wrapping) ──────────

interface VisualLineInfo {
  visualLine: number;
  visualCol: number;
  totalVisualLines: number;
  /** Character offset where current visual line starts in original text */
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

export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Called on every key press. Return `true` to prevent default handling. */
  onKeyPress?: (key: Key) => boolean | void;
  placeholder?: string;
  style?: Style;
  /** Style when focused (merged with style) */
  focusedStyle?: Style;
  /** Enable multiline editing (Enter inserts newlines, Up/Down navigate lines). */
  multiline?: boolean;
}

export function Input(props: InputProps): React.JSX.Element {
  const {
    value: controlledValue,
    defaultValue = "",
    onChange,
    onKeyPress,
    placeholder,
    style,
    focusedStyle,
    multiline,
  } = props;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [cursorPos, setCursorPos] = useState(defaultValue.length);
  const [innerWidth, setInnerWidth] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputCtx = useContext(InputContext);
  const focusCtx = useContext(FocusContext);
  const layoutCtx = useContext(LayoutContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Subscribe to layout changes to get innerWidth for visual line navigation
  useEffect(() => {
    if (!layoutCtx || !nodeRef.current) return;
    const layout = layoutCtx.getLayout(nodeRef.current);
    setInnerWidth(layout.innerWidth);
    return layoutCtx.subscribe(nodeRef.current, (rect) => {
      setInnerWidth(rect.innerWidth);
    });
  }, [layoutCtx]);

  // Keep working value/cursor in refs that update SYNCHRONOUSLY 
  // This prevents race conditions when typing faster than React renders
  const workingValueRef = useRef(value);
  const workingCursorRef = useRef(cursorPos);
  
  // Sync refs with React state when it updates
  // Also clamp cursor when value changes externally (e.g., cleared)
  useEffect(() => {
    workingValueRef.current = value;
    // If cursor is beyond the new value length, clamp it
    if (workingCursorRef.current > value.length) {
      workingCursorRef.current = value.length;
      setCursorPos(value.length);
    }
  }, [value]);
  
  useEffect(() => {
    workingCursorRef.current = cursorPos;
  }, [cursorPos]);

  // Keep a ref to current values so the handler closure always reads fresh state
  const stateRef = useRef({
    isControlled,
    onChange,
    onKeyPress,
    multiline: multiline ?? false,
    innerWidth,
  });
  stateRef.current = {
    isControlled,
    onChange,
    onKeyPress,
    multiline: multiline ?? false,
    innerWidth,
  };

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx]);

  // Subscribe to focus changes for reactive visual state
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx]);

  // Register focused input handler - returns true for consumed keys
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      const {
        isControlled: ctrl,
        onChange: cb,
        onKeyPress: onKey,
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
      const updateValue = (newVal: string, newCursor: number) => {
        workingValueRef.current = newVal;
        workingCursorRef.current = newCursor;
        if (!ctrl) setInternalValue(newVal);
        cb?.(newVal);
        setCursorPos(newCursor);
      };
      
      const updateCursor = (newCursor: number) => {
        workingCursorRef.current = newCursor;
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

      // Special/function keys we don't handle - pass through
      if (key.name.length > 1) return false;

      // Printable character - consume it
      const ch = key.sequence;
      if (ch.length === 1 && ch.charCodeAt(0) >= 32) {
        const newVal = val.slice(0, pos) + ch + val.slice(pos);
        updateValue(newVal, pos + 1);
        return true;
      }

      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx]);

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
    cursorPosition: cursorPos,
    multiline: multiline ?? false,
    focused: isFocused,
    ref: (node: any) => {
      if (node) {
        nodeRef.current = node;
        focusIdRef.current = node.focusId;
      }
    },
  });
}
