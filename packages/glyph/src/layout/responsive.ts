import type { Style, ResolvedStyle, Breakpoint } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";

/**
 * Default column thresholds for each {@link Breakpoint}.
 *
 * Breakpoints are evaluated **mobile-first** — the largest threshold that
 * does not exceed the current terminal width wins.
 *
 * | Breakpoint | Columns |
 * |------------|---------|
 * | `base`     | 0       |
 * | `sm`       | 40      |
 * | `md`       | 80      |
 * | `lg`       | 120     |
 * | `xl`       | 160     |
 *
 * @category Utilities
 */
export const defaultBreakpoints: Readonly<Record<Breakpoint, number>> = {
  base: 0,
  sm: 40,
  md: 80,
  lg: 120,
  xl: 160,
};

/** Ordered list of breakpoints from smallest to largest. */
const BREAKPOINT_ORDER: Breakpoint[] = ["base", "sm", "md", "lg", "xl"];

/** Set of valid breakpoint key names for fast look-up. */
const BREAKPOINT_KEYS = new Set<string>(BREAKPOINT_ORDER);

/**
 * Check whether a value is a responsive breakpoint object rather than a
 * plain style value.
 *
 * Detection rule: the value must be a non-null, non-array object whose
 * **every** key is a valid {@link Breakpoint} name. This cleanly separates
 * responsive objects from {@link RGBColor} (`{ r, g, b }`) and any other
 * object-shaped values.
 *
 * @param value - Any style property value.
 * @returns `true` when the value should be treated as responsive.
 */
function isResponsiveObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => BREAKPOINT_KEYS.has(k));
}

/**
 * Resolve a single {@link Responsive} value to its concrete type.
 *
 * Uses **mobile-first** logic: iterates breakpoints from smallest to
 * largest, picking the value from the last breakpoint whose threshold is
 * ≤ `columns`.
 *
 * @param value - A plain value or responsive breakpoint object.
 * @param columns - Current terminal width in columns.
 * @returns The concrete resolved value.
 *
 * @example
 * ```ts
 * resolveResponsiveValue({ base: "column", md: "row" }, 100);
 * // => "row"  (100 ≥ 80)
 *
 * resolveResponsiveValue(42, 100);
 * // => 42  (plain values pass through)
 * ```
 * @category Utilities
 */
export function resolveResponsiveValue<T>(
  value: T | { [K in Breakpoint]?: T },
  columns: number,
): T {
  if (!isResponsiveObject(value)) return value as T;

  const obj = value as Record<string, T>;
  let resolved: T | undefined;

  for (const bp of BREAKPOINT_ORDER) {
    if (columns >= defaultBreakpoints[bp] && bp in obj) {
      resolved = obj[bp];
    }
  }

  return resolved as T;
}

/**
 * Resolve all {@link Responsive} values in a {@link Style} to produce a
 * {@link ResolvedStyle} with only concrete values.
 *
 * @param style - The (possibly responsive) style object from a component.
 * @param columns - Current terminal width in columns.
 * @param _rows - Current terminal height in rows (reserved for future
 *   row-based breakpoints).
 * @returns A new style object with every responsive value collapsed.
 *
 * @example
 * ```ts
 * const resolved = resolveStyle(
 *   { padding: { base: 0, md: 1 }, bg: "red" },
 *   100,
 *   40,
 * );
 * // => { padding: 1, bg: "red" }
 * ```
 * @category Utilities
 */
export function resolveStyle(
  style: Style,
  columns: number,
  _rows: number,
): ResolvedStyle {
  const resolved: Record<string, unknown> = {};

  for (const key of Object.keys(style)) {
    const value = (style as Record<string, unknown>)[key];
    if (value === undefined) continue;
    resolved[key] = isResponsiveObject(value)
      ? resolveResponsiveValue(value, columns)
      : value;
  }

  return resolved as ResolvedStyle;
}

/**
 * Walk a node tree and populate each node's `resolvedStyle` from its
 * `style`, collapsing any responsive values for the current terminal size.
 *
 * Called once per frame **before** layout computation and painting.
 *
 * @param nodes - Root nodes of the tree to resolve.
 * @param columns - Terminal width.
 * @param rows - Terminal height.
 */
export function resolveNodeStyles(
  nodes: GlyphNode[],
  columns: number,
  rows: number,
): void {
  for (const node of nodes) {
    node.resolvedStyle = resolveStyle(node.style, columns, rows);
    resolveNodeStyles(node.children, columns, rows);
  }
}
