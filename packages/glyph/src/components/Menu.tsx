import React from "react";
import type { Style, Color } from "../types/index.js";
import { List } from "./List.js";

export interface MenuItem {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  /** Controlled selected index */
  selectedIndex?: number;
  /** Callback when selected index changes */
  onSelectionChange?: (index: number) => void;
  /** Callback when enter is pressed on item */
  onSelect?: (value: string, index: number) => void;
  /** Initial index for uncontrolled mode */
  defaultSelectedIndex?: number;
  /** Outer box style */
  style?: Style;
  /** Color for the selected item indicator and text (default: "cyan") */
  highlightColor?: Color;
  /** Whether the menu is focusable (default: true) */
  focusable?: boolean;
}

export function Menu({
  items,
  selectedIndex,
  onSelectionChange,
  onSelect,
  defaultSelectedIndex = 0,
  style,
  highlightColor = "cyan",
  focusable = true,
}: MenuProps): React.JSX.Element {
  const disabledIndices = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.disabled) disabledIndices.add(i);
  }

  const handleSelect = (index: number) => {
    const item = items[index];
    if (item && !item.disabled) {
      onSelect?.(item.value, index);
    }
  };

  return React.createElement(List, {
    count: items.length,
    selectedIndex,
    onSelectionChange,
    onSelect: handleSelect,
    defaultSelectedIndex,
    disabledIndices: disabledIndices.size > 0 ? disabledIndices : undefined,
    style,
    focusable,
    renderItem: ({ index, selected, focused }) => {
      const item = items[index]!;
      const isDisabled = item.disabled;
      const isHighlighted = selected && focused;

      const indicator = selected ? ">" : " ";

      return React.createElement(
        "box" as any,
        {
          style: {
            flexDirection: "row" as const,
            ...(isHighlighted ? { bg: highlightColor } : {}),
          },
        },
        React.createElement(
          "text" as any,
          {
            style: isHighlighted
              ? { bold: true, color: "black" }
              : isDisabled
                ? { dim: true }
                : {},
          },
          `${indicator} ${item.label}`,
        ),
      );
    },
  });
}
