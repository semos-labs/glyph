import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { FocusContext, InputContext } from "./context.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import type { Key } from "../types/index.js";

export interface UseFocusableOptions {
  /** Whether the element is currently disabled (skipped in tab order) */
  disabled?: boolean;
  /** Called when the element receives focus */
  onFocus?: () => void;
  /** Called when the element loses focus */
  onBlur?: () => void;
  /**
   * Key handler when focused. Return `true` to consume the key.
   * This runs after priority handlers but before global handlers.
   */
  onKeyPress?: (key: Key) => boolean | void;
}

export interface UseFocusableResult {
  /** Ref to attach to your focusable element */
  ref: (node: GlyphNode | null) => void;
  /** Whether this element is currently focused */
  isFocused: boolean;
  /** Programmatically request focus on this element */
  focus: () => void;
  /** The focus ID (useful for conditional logic) */
  focusId: string | null;
}

/**
 * Hook to make any element focusable with keyboard support.
 * 
 * @example
 * ```tsx
 * function CustomPicker({ onSelect }) {
 *   const { ref, isFocused, focus } = useFocusable({
 *     onKeyPress: (key) => {
 *       if (key.name === "return") {
 *         onSelect();
 *         return true;
 *       }
 *       return false;
 *     },
 *   });
 * 
 *   return (
 *     <Box
 *       ref={ref}
 *       focusable
 *       style={{ 
 *         border: "round",
 *         borderColor: isFocused ? "cyan" : "gray" 
 *       }}
 *     >
 *       <Text>Custom Picker</Text>
 *     </Box>
 *   );
 * }
 * ```
 */
export function useFocusable(options: UseFocusableOptions = {}): UseFocusableResult {
  const { disabled, onFocus, onBlur, onKeyPress } = options;
  
  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Keep callbacks in refs to avoid stale closures
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  const onKeyPressRef = useRef(onKeyPress);
  onFocusRef.current = onFocus;
  onBlurRef.current = onBlur;
  onKeyPressRef.current = onKeyPress;
  
  // Ref callback for the element
  const ref = useCallback((node: GlyphNode | null) => {
    nodeRef.current = node;
    if (node) {
      focusIdRef.current = node.focusId ?? null;
    } else {
      focusIdRef.current = null;
    }
  }, []);
  
  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx]);
  
  // Handle disabled state (mark as skippable + release focus if held)
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
    
    // Check initial focus state
    const initiallyFocused = focusCtx.focusedId === fid;
    setIsFocused(initiallyFocused);
    
    return focusCtx.onFocusChange((newId) => {
      const nowFocused = newId === fid;
      setIsFocused((wasFocused) => {
        if (nowFocused && !wasFocused) {
          onFocusRef.current?.();
        } else if (!nowFocused && wasFocused) {
          onBlurRef.current?.();
        }
        return nowFocused;
      });
    });
  }, [focusCtx]);
  
  // Register key handler when focused
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current || disabled) return;
    const fid = focusIdRef.current;
    
    const handler = (key: Key): boolean => {
      if (focusCtx?.focusedId !== fid) return false;
      return onKeyPressRef.current?.(key) === true;
    };
    
    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx, focusCtx, disabled]);
  
  // Focus function
  const focus = useCallback(() => {
    if (focusCtx && focusIdRef.current) {
      focusCtx.requestFocus(focusIdRef.current);
    }
  }, [focusCtx]);
  
  return {
    ref,
    isFocused,
    focus,
    focusId: focusIdRef.current,
  };
}
