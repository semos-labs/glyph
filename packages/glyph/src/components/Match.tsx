import React from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import type { MediaQueryInput } from "../types/index.js";

/**
 * Props for the {@link Match} component.
 */
export interface MatchProps extends MediaQueryInput {
  /**
   * Content to render when the media query matches.
   */
  children?: ReactNode;
  /**
   * Content to render when the media query does **not** match.
   *
   * @default null
   */
  fallback?: ReactNode;
}

/**
 * Conditionally render content based on terminal dimensions.
 *
 * `Match` evaluates a media query against the current terminal size and
 * renders `children` when all conditions are met, or `fallback` otherwise.
 * The component re-renders automatically on terminal resize.
 *
 * All query props are combined with AND — every specified constraint must
 * be satisfied for `children` to render.
 *
 * @example
 * ```tsx
 * // Show wide layout on terminals ≥ 80 columns
 * <Match minColumns={80}>
 *   <HorizontalLayout />
 * </Match>
 * ```
 *
 * @example
 * ```tsx
 * // With a fallback for narrow terminals
 * <Match minColumns={80} fallback={<CompactView />}>
 *   <FullView />
 * </Match>
 * ```
 *
 * @example
 * ```tsx
 * // Compound query — width AND height
 * <Match minColumns={120} minRows={30}>
 *   <DashboardLayout />
 * </Match>
 * ```
 * @category Components
 */
export function Match({
  children,
  fallback = null,
  minColumns,
  maxColumns,
  minRows,
  maxRows,
}: MatchProps): React.JSX.Element | null {
  const query: MediaQueryInput = { minColumns, maxColumns, minRows, maxRows };
  const matches = useMediaQuery(query);

  return matches
    ? (children as React.JSX.Element | null) ?? null
    : (fallback as React.JSX.Element | null) ?? null;
}
