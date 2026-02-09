import React, { useState, useEffect, useCallback, useContext, useRef, createContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { Style, Color } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import type { LayoutRect } from "../types/index.js";
import { InputContext, FocusContext, LayoutContext } from "../hooks/context.js";

// Context for JumpNav coordination
interface JumpNavContextValue {
  // Track nested JumpNavs - child blocks parent
  registerChildJumpNav: () => () => void;
  isChildActive: boolean;
}

const JumpNavContext = createContext<JumpNavContextValue | null>(null);

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
 * When nested, only the innermost JumpNav will respond to the activation key.
 */
export function JumpNav({
  children,
  activationKey = "ctrl+o",
  hintStyle,
  hintBg = "yellow",
  hintFg = "black",
  hintChars = "asdfghjklqwertyuiopzxcvbnm",
  enabled = true,
}: JumpNavProps): React.JSX.Element {
  const [isActive, setIsActive] = useState(false);
  const [inputBuffer, setInputBuffer] = useState("");
  const [hasChildJumpNav, setHasChildJumpNav] = useState(false);
  const [elements, setElements] = useState<TrackedElement[]>([]);
  
  const inputCtx = useContext(InputContext);
  const focusCtx = useContext(FocusContext);
  const layoutCtx = useContext(LayoutContext);
  const parentJumpNav = useContext(JumpNavContext);
  
  // Ref to our wrapper node - used to find descendant focusables
  const wrapperRef = useRef<GlyphNode | null>(null);

  // Register with parent JumpNav so it defers to us
  useEffect(() => {
    if (parentJumpNav) {
      return parentJumpNav.registerChildJumpNav();
    }
  }, [parentJumpNav]);

  // Context value for child JumpNavs - memoized to prevent unnecessary re-renders
  const contextValue = useMemo((): JumpNavContextValue => ({
    isChildActive: hasChildJumpNav,
    registerChildJumpNav: () => {
      setHasChildJumpNav(true);
      return () => setHasChildJumpNav(false);
    },
  }), [hasChildJumpNav]);

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

  // Walk node tree to find all focusable descendants
  const findFocusableDescendants = useCallback((node: GlyphNode): TrackedElement[] => {
    const result: TrackedElement[] = [];
    
    function walk(n: GlyphNode) {
      // If this node has a focusId, it's focusable
      if (n.focusId) {
        result.push({
          id: n.focusId,
          node: n,
          layout: layoutCtx?.getLayout(n) ?? n.layout,
        });
      }
      // Recurse into children
      for (const child of n.children) {
        walk(child);
      }
    }
    
    walk(node);
    return result;
  }, [layoutCtx]);

  // Refresh elements by walking our subtree
  const refreshElements = useCallback(() => {
    if (!wrapperRef.current) return;
    
    const descendants = findFocusableDescendants(wrapperRef.current);
    
    // Sort by visual position (top-to-bottom, left-to-right)
    descendants.sort((a, b) => {
      if (a.layout.y !== b.layout.y) {
        return a.layout.y - b.layout.y;
      }
      return a.layout.x - b.layout.x;
    });
    
    setElements(descendants);
  }, [findFocusableDescendants]);

  // Track previous isActive to detect activation transition
  const wasActiveRef = useRef(false);
  
  // Refresh elements when activated
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      refreshElements();
    }
    wasActiveRef.current = isActive;
  }, [isActive, refreshElements]);

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
    if (!inputCtx || !enabled) return;

    const handler = (key: { name?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; sequence?: string }) => {
      // Check for activation key - only if no child JumpNav exists (child takes priority)
      if (
        !isActive &&
        !hasChildJumpNav &&
        key.name === activationKeyParsed.name &&
        !!key.ctrl === activationKeyParsed.ctrl &&
        !!key.alt === activationKeyParsed.alt &&
        !!key.shift === activationKeyParsed.shift &&
        !!key.meta === activationKeyParsed.meta
      ) {
        setIsActive(true);
        setInputBuffer("");
        return true;
      }

      // When active, handle hint input
      if (isActive) {
        // Escape to cancel
        if (key.name === "escape") {
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
          
          // Check for exact match
          const targetId = visibleHintMap.get(newBuffer);
          if (targetId) {
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
  }, [inputCtx, enabled, isActive, activationKeyParsed, inputBuffer, visibleHintMap, focusCtx, hasChildJumpNav]);

  // Render floating hint labels when active (no overlay - just hints)
  const hintsOverlay = isActive ? React.createElement(
    React.Fragment,
    null,
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

  // Wrap children in an invisible box so we can walk its subtree
  const wrappedChildren = React.createElement(
    "box" as any,
    {
      ref: (node: GlyphNode | null) => { wrapperRef.current = node; },
      style: {
        // Invisible wrapper - takes full size of parent
        flexGrow: 1,
        flexDirection: "column" as const,
      },
    },
    children,
  );

  return React.createElement(
    JumpNavContext.Provider,
    { value: contextValue },
    wrappedChildren,
    hintsOverlay,
  );
}
