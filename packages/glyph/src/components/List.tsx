import React, { useContext, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import type { Style, Key, ListHandle } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { FocusContext, InputContext } from "../hooks/context.js";

/**
 * Information passed to each item's render function.
 */
export interface ListItemInfo {
  /** Zero-based index of this item. */
  index: number;
  /** Whether this item is currently selected (highlighted). */
  selected: boolean;
  /** Whether the List component itself has focus. */
  focused: boolean;
}

/**
 * Props for the {@link List} component.
 */
export interface ListProps {
  /** Total number of items */
  count: number;
  /** Render function for each item */
  renderItem: (info: ListItemInfo) => ReactNode;
  /** Controlled selected index */
  selectedIndex?: number;
  /** Callback when selected index should change */
  onSelectionChange?: (index: number) => void;
  /** Callback when enter is pressed on selected item */
  onSelect?: (index: number) => void;
  /** Initial index for uncontrolled mode */
  defaultSelectedIndex?: number;
  /** Set of disabled indices that are skipped during navigation */
  disabledIndices?: Set<number>;
  /** Outer box style */
  style?: Style;
  /** Whether the list is focusable (default: true) */
  focusable?: boolean;
}

/**
 * Keyboard-navigable list with vim-style bindings.
 *
 * Renders `count` items via a `renderItem` function, managing selection
 * state internally or through controlled props.
 *
 * **Keyboard shortcuts** (when focused):
 * | Key | Action |
 * |---|---|
 * | ↑ / k | Move selection up |
 * | ↓ / j | Move selection down |
 * | gg | Jump to first item |
 * | G | Jump to last item |
 * | Enter | Confirm selection |
 *
 * @example
 * ```tsx
 * <List
 *   count={items.length}
 *   renderItem={({ index, selected, focused }) => (
 *     <Box style={{ bg: selected && focused ? "cyan" : undefined }}>
 *       <Text>{items[index].name}</Text>
 *     </Box>
 *   )}
 *   onSelect={(index) => console.log("Selected:", items[index])}
 * />
 * ```
 */
export const List = forwardRef<ListHandle, ListProps>(
  function List({
    count,
    renderItem,
    selectedIndex: controlledIndex,
    onSelectionChange,
    onSelect,
    defaultSelectedIndex = 0,
    disabledIndices,
    style,
    focusable = true,
  }, ref) {
  const isControlled = controlledIndex !== undefined;
  const [internalIndex, setInternalIndex] = useState(defaultSelectedIndex);
  const selectedIndex = isControlled ? controlledIndex : internalIndex;

  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
    get selectedIndex() {
      return selectedIndex;
    },
  }), [focusCtx, isFocused, selectedIndex]);
  const lastKeyRef = useRef<string | null>(null);

  const setIndex = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, count - 1));
      if (isControlled) {
        onSelectionChange?.(clamped);
      } else {
        setInternalIndex(clamped);
      }
    },
    [isControlled, onSelectionChange, count],
  );

  // Find next non-disabled index in given direction
  const findNextEnabled = useCallback(
    (from: number, direction: 1 | -1): number => {
      if (!disabledIndices || disabledIndices.size === 0) {
        return Math.max(0, Math.min(from + direction, count - 1));
      }
      let next = from + direction;
      while (next >= 0 && next < count && disabledIndices.has(next)) {
        next += direction;
      }
      if (next < 0 || next >= count) return from; // stay put
      return next;
    },
    [disabledIndices, count],
  );

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current || !focusable) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx, focusable, nodeReady]);

  // Subscribe to focus changes
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx, nodeReady]);

  // Find first non-disabled index from start or end
  const findFirstEnabled = useCallback(
    (fromEnd: boolean): number => {
      const start = fromEnd ? count - 1 : 0;
      const direction = fromEnd ? -1 : 1;
      let index = start;
      while (index >= 0 && index < count && disabledIndices?.has(index)) {
        index += direction;
      }
      return index >= 0 && index < count ? index : (fromEnd ? count - 1 : 0);
    },
    [disabledIndices, count],
  );

  // Handle keyboard when focused
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current || !focusable) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      if (focusCtx?.focusedId !== fid) return false;

      // gg - go to top (requires two consecutive 'g' presses)
      if (key.name === "g" && !key.ctrl && !key.alt) {
        if (lastKeyRef.current === "g") {
          setIndex(findFirstEnabled(false));
          lastKeyRef.current = null;
          return true;
        }
        lastKeyRef.current = "g";
        return true;
      }

      // G - go to bottom
      if (key.name === "G" || (key.name === "g" && key.shift)) {
        lastKeyRef.current = null;
        setIndex(findFirstEnabled(true));
        return true;
      }

      // Clear lastKey for any other key
      lastKeyRef.current = null;

      // Up / k - move up
      if (key.name === "up" || key.name === "k") {
        setIndex(findNextEnabled(selectedIndex, -1));
        return true;
      }

      // Down / j - move down
      if (key.name === "down" || key.name === "j") {
        setIndex(findNextEnabled(selectedIndex, 1));
        return true;
      }

      // Enter - select
      if (key.name === "return") {
        if (!(disabledIndices?.has(selectedIndex))) {
          onSelectRef.current?.(selectedIndex);
        }
        return true;
      }

      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx, focusCtx, focusable, selectedIndex, setIndex, findNextEnabled, findFirstEnabled, disabledIndices, nodeReady]);

  // Render items
  const items: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    items.push(
      React.createElement(React.Fragment, { key: i },
        renderItem({ index: i, selected: i === selectedIndex, focused: isFocused }),
      ),
    );
  }

  return React.createElement(
    "box" as any,
    {
      style: { flexDirection: "column" as const, ...style },
      focusable: focusable,
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
    ...items,
  );
  }
);
