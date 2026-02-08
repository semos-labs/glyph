import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import type { Style, Key } from "../types/index.js";
import { FocusContext, InputContext } from "../hooks/context.js";
import type { GlyphNode } from "../reconciler/nodes.js";

export interface RadioItem<T = string> {
  /** Display label */
  label: string;
  /** Value returned on selection */
  value: T;
  /** Whether this option is disabled */
  disabled?: boolean;
}

export interface RadioProps<T = string> {
  /** Radio options */
  items: RadioItem<T>[];
  /** Currently selected value */
  value: T | undefined;
  /** Called when selection changes */
  onChange: (value: T) => void;
  /** Style for the radio group container */
  style?: Style;
  /** Style for each radio item */
  itemStyle?: Style;
  /** Style for the focused item */
  focusedItemStyle?: Style;
  /** Style for the selected item */
  selectedItemStyle?: Style;
  /** Whether the entire group is disabled */
  disabled?: boolean;
  /** Layout direction (default: "column") */
  direction?: "row" | "column";
  /** Gap between items (default: 0) */
  gap?: number;
  /** Custom character for selected state (default: "●") */
  selectedChar?: string;
  /** Custom character for unselected state (default: "○") */
  unselectedChar?: string;
}

export function Radio<T = string>({
  items,
  value,
  onChange,
  style,
  itemStyle,
  focusedItemStyle,
  selectedItemStyle,
  disabled,
  direction = "column",
  gap = 0,
  selectedChar = "●",
  unselectedChar = "○",
}: RadioProps<T>): React.JSX.Element {
  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track when node is mounted with a valid focusId
  const [nodeReady, setNodeReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() => {
    // Initialize to the selected item or first enabled item
    const selectedIdx = items.findIndex((item) => item.value === value);
    if (selectedIdx >= 0) return selectedIdx;
    return items.findIndex((item) => !item.disabled);
  });

  // Find next/prev enabled item
  const findNextEnabled = useCallback(
    (startIndex: number, direction: 1 | -1): number => {
      let index = startIndex;
      for (let i = 0; i < items.length; i++) {
        index = (index + direction + items.length) % items.length;
        if (!items[index]?.disabled) return index;
      }
      return startIndex;
    },
    [items],
  );

  // Register with focus system
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current || disabled) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx, disabled, nodeReady]);

  // Subscribe to focus changes
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx, nodeReady]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current || disabled) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      if (focusCtx?.focusedId !== fid) return false;

      // Previous: up, left, k, shift+tab
      if (
        key.name === "up" ||
        key.name === "left" ||
        key.name === "k" ||
        (key.name === "tab" && key.shift)
      ) {
        setHighlightedIndex((idx) => findNextEnabled(idx, -1));
        return true;
      }

      // Next: down, right, j, tab
      if (
        key.name === "down" ||
        key.name === "right" ||
        key.name === "j" ||
        (key.name === "tab" && !key.shift)
      ) {
        setHighlightedIndex((idx) => findNextEnabled(idx, 1));
        return true;
      }

      // Select current item
      if (key.name === "return" || key.name === " " || key.sequence === " ") {
        const item = items[highlightedIndex];
        if (item && !item.disabled) {
          onChangeRef.current(item.value);
        }
        return true;
      }

      return false;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [inputCtx, focusCtx, disabled, items, highlightedIndex, findNextEnabled, nodeReady]);

  // Sync highlighted index when value changes externally
  useEffect(() => {
    const selectedIdx = items.findIndex((item) => item.value === value);
    if (selectedIdx >= 0) {
      setHighlightedIndex(selectedIdx);
    }
  }, [value, items]);

  const containerStyle: Style = {
    flexDirection: direction,
    gap,
    ...style,
  };

  const radioItems = items.map((item, index) => {
    const isSelected = item.value === value;
    const isHighlighted = index === highlightedIndex;
    const isItemDisabled = disabled || item.disabled;

    const radioChar = isSelected ? selectedChar : unselectedChar;

    let computedStyle: Style = {
      flexDirection: "row",
      gap: 1,
      ...itemStyle,
    };

    if (isSelected && selectedItemStyle) {
      computedStyle = { ...computedStyle, ...selectedItemStyle };
    }

    if (isFocused && isHighlighted && focusedItemStyle) {
      computedStyle = { ...computedStyle, ...focusedItemStyle };
    }

    const textColor = isItemDisabled
      ? "blackBright"
      : isFocused && isHighlighted
        ? focusedItemStyle?.color ?? "white"
        : isSelected
          ? selectedItemStyle?.color ?? itemStyle?.color
          : itemStyle?.color;

    return React.createElement(
      "box" as any,
      { key: index, style: computedStyle },
      React.createElement(
        "text" as any,
        { key: "radio", style: { color: textColor } },
        `(${radioChar})`,
      ),
      React.createElement(
        "text" as any,
        { key: "label", style: { color: textColor } },
        item.label,
      ),
    );
  });

  return React.createElement(
    "box" as any,
    {
      style: containerStyle,
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
    ...radioItems,
  );
}
