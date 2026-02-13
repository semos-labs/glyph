import React, { forwardRef } from "react";
import type { Style } from "../types/index.js";
import type { ReactNode, Ref } from "react";
import type { GlyphNode } from "../reconciler/nodes.js";

/**
 * Props for the {@link Box} component.
 */
export interface BoxProps {
  /** Flexbox style object controlling layout, colors, borders, and more. */
  style?: Style;
  /** Child elements to render inside the box. */
  children?: ReactNode;
  /** When `true`, the box participates in the focus (Tab) order. */
  focusable?: boolean;
}

/**
 * Generic layout container — the building block of every Glyph UI.
 *
 * `Box` maps directly to a Yoga flexbox node, so all CSS-like flex
 * properties (`flexDirection`, `gap`, `padding`, `alignItems`, …) work
 * out of the box.
 *
 * @example
 * ```tsx
 * <Box style={{ flexDirection: "row", gap: 1, padding: 1 }}>
 *   <Text>Hello</Text>
 *   <Text>World</Text>
 * </Box>
 * ```
 *
 * @example
 * ```tsx
 * // Centered card with a border
 * <Box
 *   style={{
 *     border: "round",
 *     borderColor: "cyan",
 *     padding: 1,
 *     alignItems: "center",
 *     justifyContent: "center",
 *     width: 40,
 *     height: 10,
 *   }}
 * >
 *   <Text style={{ bold: true }}>Welcome!</Text>
 * </Box>
 * ```
 */
export const Box = forwardRef<GlyphNode, BoxProps>(
  function Box({ children, style, focusable }, ref): React.JSX.Element {
    return React.createElement("box" as any, { style, focusable, ref }, children);
  }
);
