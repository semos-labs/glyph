import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import type { Style, Color } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import type { LayoutRect } from "../types/index.js";
import { InputContext, FocusContext, LayoutContext } from "../hooks/context.js";

interface TrackedElement {
  id: string;
  node: GlyphNode;
  layout: LayoutRect;
}

export interface JumpNavProps {
  children?: ReactNode;
  /** Keybind to activate jump mode (default: "ctrl+o") */
  activationKey?: string;
  /** Style for the hint labels */
  hintStyle?: Style;
  /** Color for hint background (default: "yellow") */
  hintBg?: Color;
  /** Color for hint text (default: "black") */
  hintFg?: Color;
  /** Characters to use for hints (default: "asdfghjklqwertyuiopzxcvbnm") */
  hintChars?: string;
  /** Whether jump nav is enabled (default: true) */
  enabled?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

// Generate hint keys for N elements
function generateHints(count: number, chars: string): string[] {
  const hints: string[] = [];
  const charList = chars.split("");
  
  if (count <= charList.length) {
    // Single character hints
    for (let i = 0; i < count; i++) {
      hints.push(charList[i]!);
    }
  } else {
    // Two character hints for larger lists
    for (let i = 0; i < charList.length && hints.length < count; i++) {
      for (let j = 0; j < charList.length && hints.length < count; j++) {
        hints.push(charList[i]! + charList[j]!);
      }
    }
  }
  
  return hints;
}

/**
 * JumpNav provides vim-style quick navigation to focusable elements.
 * Press the activation key (default: Ctrl+O) to show hints next to each
 * focusable element, then press the hint key to jump to that element.
 * 
 * JumpNav is trap-aware: it automatically only shows hints for elements
 * in the current FocusScope trap (e.g., a modal). You only need ONE JumpNav
 * at the root of your app.
 */
export function JumpNav({
  children,
  activationKey = "ctrl+o",
  hintStyle,
  hintBg = "yellow",
  hintFg = "black",
  hintChars = "asdfghjklqwertyuiopzxcvbnm",
  enabled = true,
  debug = false,
}: JumpNavProps): React.JSX.Element {
  const log = debug ? (...args: any[]) => console.error('[JumpNav]', ...args) : () => {};
  
  const [isActive, setIsActive] = useState(false);
  const [inputBuffer, setInputBuffer] = useState("");
  const [elements, setElements] = useState<TrackedElement[]>([]);
  
  const inputCtx = useContext(InputContext);
  const focusCtx = useContext(FocusContext);
  const layoutCtx = useContext(LayoutContext);

  // Log mount info
  useEffect(() => {
    log('Mounted, inputCtx:', !!inputCtx, 'focusCtx:', !!focusCtx, 'enabled:', enabled);
  }, []);

  // Parse activation key
  const parseKey = useCallback((keyStr: string) => {
    const parts = keyStr.toLowerCase().split("+");
    return {
      ctrl: parts.includes("ctrl"),
      alt: parts.includes("alt"),
      shift: parts.includes("shift"),
      meta: parts.includes("meta"),
      name: parts[parts.length - 1] ?? "",
    };
  }, []);

  const activationKeyParsed = parseKey(activationKey);

  // Refresh elements from the ACTIVE focus scope (trap-aware)
  const refreshElements = useCallback(() => {
    if (!focusCtx?.getActiveElements) {
      log('refreshElements: no getActiveElements');
      return;
    }
    
    const active = focusCtx.getActiveElements();
    log('getActiveElements returned', active.length, 'elements');
    
    const mapped: TrackedElement[] = active.map(({ id, node }) => ({
      id,
      node,
      layout: layoutCtx?.getLayout(node) ?? node.layout,
    }));
    
    // Sort by visual position (top-to-bottom, left-to-right)
    mapped.sort((a, b) => {
      if (a.layout.y !== b.layout.y) {
        return a.layout.y - b.layout.y;
      }
      return a.layout.x - b.layout.x;
    });
    
    setElements(mapped);
  }, [focusCtx, layoutCtx, log]);

  // Track previous isActive to detect activation transition
  const wasActiveRef = useRef(false);
  
  // Refresh elements when activated
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      log('Activated! Refreshing elements...');
      refreshElements();
    }
    wasActiveRef.current = isActive;
  }, [isActive, refreshElements, log]);

  // Filter elements with valid layout (visible and computed)
  const visibleElements = elements.filter(el => 
    el.layout.width > 0 && el.layout.height > 0
  );
  const visibleHints = generateHints(visibleElements.length, hintChars);

  // Create visible hint -> element mapping
  const visibleHintMap = useMemo(() => {
    const map = new Map<string, string>();
    visibleElements.forEach((el, i) => {
      if (visibleHints[i]) {
        map.set(visibleHints[i]!, el.id);
      }
    });
    return map;
  }, [visibleElements, visibleHints]);

  // Handle key input
  useEffect(() => {
    if (!inputCtx || !enabled) {
      log('Not subscribing - inputCtx:', !!inputCtx, 'enabled:', enabled);
      return;
    }

    log('Subscribing to priority input, activation key:', activationKey);

    const handler = (key: { name?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; sequence?: string }) => {
      // Check for activation key
      const nameMatch = key.name === activationKeyParsed.name;
      const ctrlMatch = !!key.ctrl === activationKeyParsed.ctrl;
      const altMatch = !!key.alt === activationKeyParsed.alt;
      const shiftMatch = !!key.shift === activationKeyParsed.shift;
      const metaMatch = !!key.meta === activationKeyParsed.meta;
      
      if (
        !isActive &&
        nameMatch && ctrlMatch && altMatch && shiftMatch && metaMatch
      ) {
        log('Activation key matched! Activating...');
        setIsActive(true);
        setInputBuffer("");
        return true;
      }

      // When active, handle hint input
      if (isActive) {
        // Escape to cancel
        if (key.name === "escape") {
          log('Escape pressed, deactivating');
          setIsActive(false);
          setInputBuffer("");
          return true;
        }

        // Backspace to clear buffer
        if (key.name === "backspace") {
          setInputBuffer("");
          return true;
        }

        // Letter input
        if (key.sequence && key.sequence.length === 1 && /[a-z]/i.test(key.sequence)) {
          const newBuffer = inputBuffer + key.sequence.toLowerCase();
          log('Buffer:', newBuffer);
          
          // Check for exact match
          const targetId = visibleHintMap.get(newBuffer);
          if (targetId) {
            log('Jumping to', targetId);
            focusCtx?.requestFocus(targetId);
            setIsActive(false);
            setInputBuffer("");
            return true;
          }
          
          // Check if any hint starts with this buffer
          const hasPartialMatch = [...visibleHintMap.keys()].some(h => h.startsWith(newBuffer));
          if (hasPartialMatch) {
            setInputBuffer(newBuffer);
            return true;
          }
          
          // No match - reset
          setInputBuffer("");
          return true;
        }

        // Consume all other keys when active
        return true;
      }

      return false;
    };

    // Use priority handler so we capture keys before focused inputs
    return inputCtx.subscribePriority(handler);
  }, [inputCtx, enabled, isActive, activationKeyParsed, inputBuffer, visibleHintMap, focusCtx, activationKey, log]);

  // Render floating hint labels when active - wrapped in Portal to not affect layout
  const hintsOverlay = isActive ? React.createElement(
    "box" as any,
    {
      // Portal-like wrapper - fullscreen absolute overlay
      style: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 99998,
      },
    },
    // Hint labels - floating on top of content
    ...visibleElements.map((el, i) => {
      const hint = visibleHints[i];
      if (!hint) return null;
      
      // Position hint at element's location
      const { x, y } = el.layout;
      
      // Highlight matching prefix
      const isPartialMatch = hint.startsWith(inputBuffer) && inputBuffer.length > 0;
      
      return React.createElement(
        "box" as any,
        {
          key: el.id,
          style: {
            position: "absolute" as const,
            top: y,
            left: Math.max(0, x - hint.length - 2),
            bg: isPartialMatch ? "cyan" : hintBg,
            color: hintFg,
            paddingX: 1,
            zIndex: 99999,
            ...hintStyle,
          },
        },
        React.createElement("text" as any, {
          style: { bold: true, color: hintFg },
        }, hint),
      );
    }),
    // Status bar at bottom
    React.createElement(
      "box" as any,
      {
        style: {
          position: "absolute" as const,
          bottom: 0,
          left: 0,
          right: 0,
          bg: "blackBright" as const,
          paddingX: 1,
          zIndex: 99999,
        },
      },
      React.createElement("text" as any, {
        style: { color: "white" as const },
      }, inputBuffer ? `Jump: ${inputBuffer}_` : "Press a key to jump • ESC to cancel"),
    ),
  ) : null;

  return React.createElement(
    React.Fragment,
    null,
    children,
    hintsOverlay,
  );
}
