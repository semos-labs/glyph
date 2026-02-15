import { useContext, useCallback, useSyncExternalStore } from "react";
import { AppContext } from "./context.js";
import type { MediaQueryInput } from "../types/index.js";

/**
 * Evaluate a media query against the current terminal dimensions.
 *
 * @param query - Query conditions.
 * @param columns - Current terminal width.
 * @param rows - Current terminal height.
 * @returns `true` when **all** conditions are met.
 */
function evaluateQuery(
  query: MediaQueryInput,
  columns: number,
  rows: number,
): boolean {
  if (query.minColumns !== undefined && columns < query.minColumns) return false;
  if (query.maxColumns !== undefined && columns > query.maxColumns) return false;
  if (query.minRows !== undefined && rows < query.minRows) return false;
  if (query.maxRows !== undefined && rows > query.maxRows) return false;
  return true;
}

/**
 * Subscribe to terminal dimensions and evaluate a media query reactively.
 *
 * Returns `true` when **all** conditions in `query` are satisfied and
 * automatically re-renders the component when the result changes (e.g.
 * on terminal resize).
 *
 * Conditions are combined with AND — every specified constraint must be
 * met for the hook to return `true`.
 *
 * @param query - A {@link MediaQueryInput} object describing the conditions.
 * @returns Whether the query currently matches.
 *
 * @example
 * ```tsx
 * function App() {
 *   const isWide = useMediaQuery({ minColumns: 80 });
 *
 *   return (
 *     <Box style={{ flexDirection: isWide ? "row" : "column" }}>
 *       <Sidebar />
 *       <MainContent />
 *     </Box>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Compound query — all conditions must match
 * const isDesktop = useMediaQuery({ minColumns: 120, minRows: 30 });
 * ```
 * @category Hooks
 */
export function useMediaQuery(query: MediaQueryInput): boolean {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useMediaQuery must be used within a Glyph render tree");
  }

  // Destructure so useCallback depends on primitive values rather than the
  // query object reference (callers typically pass inline objects).
  const { minColumns, maxColumns, minRows, maxRows } = query;

  const subscribe = useCallback(
    (callback: () => void) => ctx.onResize(callback),
    [ctx],
  );

  const getSnapshot = useCallback(
    () =>
      evaluateQuery(
        { minColumns, maxColumns, minRows, maxRows },
        ctx.columns,
        ctx.rows,
      ),
    [minColumns, maxColumns, minRows, maxRows, ctx],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
