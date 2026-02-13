import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { ReactNode } from "react";
import type { Style, Key, Color, SelectHandle } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { FocusContext, InputContext, AppContext, ScrollViewContext } from "../hooks/context.js";
import { useLayout } from "../hooks/useLayout.js";

/**
 * A single option inside a {@link Select} dropdown.
 */
export interface SelectItem {
  /** Display text shown in the dropdown. */
  label: string;
  /** Value returned when this item is selected. */
  value: string;
  /** When `true`, the item is dimmed and cannot be selected. */
  disabled?: boolean;
}

/**
 * Props for the {@link Select} component.
 */
export interface SelectProps {
  /** List of selectable items */
  items: SelectItem[];
  /** Currently selected value (controlled) */
  value?: string;
  /** Callback when selection changes */
  onChange?: (value: string) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Trigger box style */
  style?: Style;
  /** Trigger style when focused */
  focusedStyle?: Style;
  /** Dropdown overlay style overrides */
  dropdownStyle?: Style;
  /** Highlight color for the selected item in the dropdown (default: "cyan") */
  highlightColor?: Color;
  /** Max visible items in the dropdown before scrolling (default: 8) */
  maxVisible?: number;
  /** Enable type-to-filter when dropdown is open (default: true) */
  searchable?: boolean;
  /** Force dropdown open direction: "up", "down", or "auto" (default: "auto") */
  openDirection?: "up" | "down" | "auto";
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Dropdown select with keyboard navigation, type-to-filter, and scrolling.
 *
 * Opens on **Space** or **Enter**. Close with **Escape** or **Tab**.
 * Type to filter when open (if `searchable` is enabled).
 *
 * Automatically detects whether to open upward or downward based on
 * available space, unless you override with `openDirection`.
 *
 * @example
 * ```tsx
 * const [color, setColor] = useState<string>();
 *
 * <Select
 *   items={[
 *     { label: "Red",   value: "red" },
 *     { label: "Green", value: "green" },
 *     { label: "Blue",  value: "blue" },
 *   ]}
 *   value={color}
 *   onChange={setColor}
 *   placeholder="Pick a color"
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Force dropdown to always open upward
 * <Select items={items} value={v} onChange={setV} openDirection="up" />
 * ```
 */
export const Select = forwardRef<SelectHandle, SelectProps>(
  function Select({
    items,
    value,
    onChange,
    placeholder = "Select...",
    style,
    focusedStyle,
    dropdownStyle,
    highlightColor = "cyan",
    maxVisible = 8,
    searchable = true,
    openDirection = "auto",
    disabled,
  }, ref) {
  const focusCtx = useContext(FocusContext);
  const inputCtx = useContext(InputContext);
  const appCtx = useContext(AppContext);
  const scrollViewCtx = useContext(ScrollViewContext);
  const nodeRef = useRef<GlyphNode | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track when node is mounted with a valid focusId - this triggers effect re-runs
  const [nodeReady, setNodeReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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
      return value;
    },
    get isOpen() {
      return isOpen;
    },
  }), [focusCtx, isFocused, value, isOpen]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);

  const triggerLayout = useLayout(nodeRef);
  const screenRows = appCtx?.rows ?? 24;
  
  // Get ScrollView bounds if we're inside one
  const scrollViewBounds = scrollViewCtx?.getBounds();

  // Selected item label
  const selectedItem = items.find((item) => item.value === value);
  const selectedLabel = selectedItem?.label ?? "";

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchText) return items;
    const lower = searchText.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(lower));
  }, [items, searchText]);

  // Visible slice
  const visibleCount = Math.min(maxVisible, filteredItems.length);
  const visibleItems = filteredItems.slice(
    scrollOffset,
    scrollOffset + visibleCount,
  );

  // Reset highlight and scroll when filter changes
  useEffect(() => {
    setHighlightIndex(0);
    setScrollOffset(0);
  }, [searchText]);

  // Close dropdown when focus is lost
  useEffect(() => {
    if (!isFocused && isOpen) {
      setIsOpen(false);
      setSearchText("");
    }
  }, [isFocused, isOpen]);

  // --- Focus registration ---
  // Always register on mount to maintain position in tab order
  // nodeReady triggers re-run when ref callback fires
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current || !nodeRef.current) return;
    return focusCtx.register(focusIdRef.current, nodeRef.current);
  }, [focusCtx, nodeReady]);
  
  // Mark as skippable when disabled - Tab will skip this element
  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    focusCtx.setSkippable(focusIdRef.current, !!disabled);
  }, [focusCtx, disabled, nodeReady]);

  useEffect(() => {
    if (!focusCtx || !focusIdRef.current) return;
    const fid = focusIdRef.current;
    setIsFocused(focusCtx.focusedId === fid);
    return focusCtx.onFocusChange((newId) => {
      setIsFocused(newId === fid);
    });
  }, [focusCtx, nodeReady]);

  // Find next non-disabled index
  const findNextEnabled = useCallback(
    (from: number, direction: 1 | -1): number => {
      let next = from + direction;
      while (next >= 0 && next < filteredItems.length) {
        if (!filteredItems[next]!.disabled) return next;
        next += direction;
      }
      return from;
    },
    [filteredItems],
  );

  // Scroll to keep highlight visible
  const ensureVisible = useCallback(
    (index: number) => {
      if (index < scrollOffset) {
        setScrollOffset(index);
      } else if (index >= scrollOffset + visibleCount) {
        setScrollOffset(index - visibleCount + 1);
      }
    },
    [scrollOffset, visibleCount],
  );

  // --- Input handler ---
  // nodeReady ensures we re-run when the ref is set after conditional mount
  useEffect(() => {
    if (!inputCtx || !focusIdRef.current || disabled) return;
    const fid = focusIdRef.current;

    const handler = (key: Key): boolean => {
      if (focusCtx?.focusedId !== fid) return false;

      // --- Closed state ---
      if (!isOpen) {
        if (
          key.name === "return" ||
          key.name === " " ||
          key.sequence === " "
        ) {
          setIsOpen(true);
          setSearchText("");
          const idx = filteredItems.findIndex((item) => item.value === value);
          const start = idx >= 0 ? idx : 0;
          setHighlightIndex(start);
          setScrollOffset(
            Math.max(0, start - Math.floor(maxVisible / 2)),
          );
          return true;
        }
        return false;
      }

      // --- Open state ---

      // Tab: close and let focus system handle
      if (key.name === "tab") {
        setIsOpen(false);
        setSearchText("");
        return false;
      }

      if (key.name === "escape") {
        setIsOpen(false);
        setSearchText("");
        return true;
      }

      if (key.name === "return") {
        const item = filteredItems[highlightIndex];
        if (item && !item.disabled) {
          onChangeRef.current?.(item.value);
          setIsOpen(false);
          setSearchText("");
        }
        return true;
      }

      if (key.name === "up") {
        const next = findNextEnabled(highlightIndex, -1);
        setHighlightIndex(next);
        ensureVisible(next);
        return true;
      }

      if (key.name === "down") {
        const next = findNextEnabled(highlightIndex, 1);
        setHighlightIndex(next);
        ensureVisible(next);
        return true;
      }

      if (key.name === "backspace") {
        if (searchable && searchText.length > 0) {
          setSearchText((prev) => prev.slice(0, -1));
        }
        return true;
      }

      if (key.name === "home") {
        const first = findNextEnabled(-1, 1);
        setHighlightIndex(first);
        ensureVisible(first);
        return true;
      }

      if (key.name === "end") {
        const last = findNextEnabled(filteredItems.length, -1);
        setHighlightIndex(last);
        ensureVisible(last);
        return true;
      }

      // Printable characters → search filter
      if (
        searchable &&
        key.sequence &&
        key.sequence.length === 1 &&
        !key.ctrl &&
        !key.alt
      ) {
        const ch = key.sequence;
        if (ch >= " " && ch <= "~") {
          setSearchText((prev) => prev + ch);
          return true;
        }
      }

      // Consume all other keys when open
      return true;
    };

    return inputCtx.registerInputHandler(fid, handler);
  }, [
    inputCtx,
    focusCtx,
    disabled,
    isOpen,
    highlightIndex,
    filteredItems,
    value,
    maxVisible,
    searchable,
    searchText,
    findNextEnabled,
    ensureVisible,
    nodeReady,
  ]);

  // --- Trigger ---
  // Only apply default border if user hasn't specified bg (flat style) or their own border
  const useDefaultBorder = !style?.bg && style?.border === undefined;
  const triggerStyle: Style = {
    flexDirection: "row",
    width: "100%",
    ...(useDefaultBorder ? { border: "single" } : {}),
    ...style,
    ...(isFocused && focusedStyle ? focusedStyle : {}),
  };

  const labelColor = selectedLabel
    ? style?.color ?? undefined
    : "blackBright";

  const triggerChildren: ReactNode[] = [
    React.createElement(
      "text" as any,
      {
        key: "label",
        style: {
          flexGrow: 1,
          flexShrink: 1,
          color: labelColor,
          wrap: "ellipsis",
          ...(selectedLabel ? {} : { dim: true }),
        },
      },
      selectedLabel || placeholder,
    ),
    React.createElement(
      "text" as any,
      {
        key: "arrow",
        style: { flexShrink: 0, color: isFocused ? highlightColor : "blackBright" },
      },
      isOpen ? " ▲" : " ▼",
    ),
  ];

  // --- Dropdown ---
  let dropdownElement: ReactNode = null;

  if (isOpen) {
    const dropdownChildren: ReactNode[] = [];

    // Search indicator
    if (searchable && searchText) {
      dropdownChildren.push(
        React.createElement(
          "box" as any,
          { key: "search", style: { paddingX: 1 } },
          React.createElement(
            "text" as any,
            { style: { color: "blackBright", dim: true } },
            `/${searchText}`,
          ),
        ),
      );
    }

    // No results
    if (filteredItems.length === 0) {
      dropdownChildren.push(
        React.createElement(
          "box" as any,
          { key: "empty", style: { paddingX: 1 } },
          React.createElement(
            "text" as any,
            { style: { dim: true, color: "blackBright" } },
            "No matches",
          ),
        ),
      );
    }

    // Scroll up indicator
    if (scrollOffset > 0) {
      dropdownChildren.push(
        React.createElement(
          "box" as any,
          {
            key: "scroll-up",
            style: { justifyContent: "center", alignItems: "center" },
          },
          React.createElement(
            "text" as any,
            { style: { dim: true, color: "blackBright" } },
            "▲",
          ),
        ),
      );
    }

    // Visible items
    visibleItems.forEach((item, vi) => {
      const actualIndex = scrollOffset + vi;
      const isHighlighted = actualIndex === highlightIndex;
      const isDisabled = item.disabled;

      const itemStyle: Style = {
        paddingX: 1,
        ...(isHighlighted && !isDisabled ? { bg: highlightColor } : {}),
      };

      const textStyle: Style = {
        ...(isHighlighted && !isDisabled
          ? { color: "black", bold: true }
          : {}),
        ...(isDisabled ? { dim: true, color: "blackBright" } : {}),
      };

      dropdownChildren.push(
        React.createElement(
          "box" as any,
          { key: `item-${item.value}`, style: itemStyle },
          React.createElement(
            "text" as any,
            { style: textStyle },
            item.label,
          ),
        ),
      );
    });

    // Scroll down indicator
    if (scrollOffset + visibleCount < filteredItems.length) {
      dropdownChildren.push(
        React.createElement(
          "box" as any,
          {
            key: "scroll-down",
            style: { justifyContent: "center", alignItems: "center" },
          },
          React.createElement(
            "text" as any,
            { style: { dim: true, color: "blackBright" } },
            "▼",
          ),
        ),
      );
    }

    // Calculate dropdown height (items + border + scroll indicators + search)
    const hasScrollUp = scrollOffset > 0;
    const hasScrollDown = scrollOffset + visibleCount < filteredItems.length;
    const hasSearch = searchable && searchText;
    const hasNoMatches = filteredItems.length === 0;
    
    // Only apply default border if user hasn't specified their own dropdown style
    const useDropdownBorder = !dropdownStyle?.bg && dropdownStyle?.border === undefined;
    const borderSize = useDropdownBorder ? 2 : 0; // top + bottom border
    
    let dropdownHeight = visibleCount + borderSize;
    if (hasScrollUp) dropdownHeight += 1;
    if (hasScrollDown) dropdownHeight += 1;
    if (hasSearch) dropdownHeight += 1;
    if (hasNoMatches) dropdownHeight += 1;
    
    // Determine if we should open upward
    // Consider ScrollView bounds if inside one, otherwise use screen bounds
    const triggerBottom = triggerLayout.y + triggerLayout.height;
    
    let spaceBelow: number;
    let spaceAbove: number;
    
    if (scrollViewBounds) {
      // Inside ScrollView - use ScrollView's visible bounds
      spaceBelow = scrollViewBounds.visibleBottom - triggerBottom;
      spaceAbove = triggerLayout.y - scrollViewBounds.visibleTop;
    } else {
      // Not inside ScrollView - use screen bounds
      spaceBelow = screenRows - triggerBottom;
      spaceAbove = triggerLayout.y;
    }
    
    // Determine open direction
    const openUpward = openDirection === "up" 
      ? true 
      : openDirection === "down" 
        ? false 
        : spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight;
    
    const dropdownTop = openUpward 
      ? -(dropdownHeight) 
      : (triggerLayout.height || 1);

    dropdownElement = React.createElement(
      "box" as any,
      {
        style: {
          position: "absolute" as const,
          top: dropdownTop,
          left: 0,
          right: 0,
          zIndex: 9999,
          ...(useDropdownBorder ? { border: "single" as const } : {}),
          bg: "black" as const,
          flexDirection: "column" as const,
          ...dropdownStyle,
        },
      },
      ...dropdownChildren,
    );
  }

  // --- Render ---
  // Extract width/flex properties for outer wrapper
  // Default to filling available space if no explicit width is set
  const outerStyle: Style = {
    flexDirection: "column" as const,
    width: triggerStyle.width ?? "100%",
    minWidth: triggerStyle.minWidth,
    maxWidth: triggerStyle.maxWidth,
    flexGrow: triggerStyle.flexGrow,
    flexShrink: triggerStyle.flexShrink ?? 1,
  };

  return React.createElement(
    "box" as any,
    { style: outerStyle },
    // Trigger
    React.createElement(
      "box" as any,
      {
        style: triggerStyle,
        // Always focusable - disabled state is handled in input handler
        // This ensures focusId is assigned on mount, even if initially disabled
        focusable: true,
        ref: (node: any) => {
          if (node) {
            nodeRef.current = node;
            focusIdRef.current = node.focusId;
            // Trigger effect re-runs now that refs are set
            setNodeReady(true);
          } else {
            // Node unmounted
            nodeRef.current = null;
            focusIdRef.current = null;
            setNodeReady(false);
          }
        },
      },
      ...triggerChildren,
    ),
    // Dropdown overlay
    dropdownElement,
  );
  }
);
