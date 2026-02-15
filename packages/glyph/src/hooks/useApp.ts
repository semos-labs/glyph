import { useContext, useCallback, useSyncExternalStore } from "react";
import { AppContext } from "./context.js";

/**
 * Return type of {@link useApp}.
 */
export interface UseAppResult {
  /** Terminate the application, optionally with an exit code. */
  exit(code?: number): void;
  /** Force a full redraw of the entire screen (clear + repaint). */
  forceRedraw(): void;
  /** Current terminal width in columns. Updates on resize. */
  columns: number;
  /** Current terminal height in rows. Updates on resize. */
  rows: number;
}

/**
 * Access application-level utilities: exit, terminal dimensions.
 *
 * Must be called inside a Glyph render tree (i.e. inside a component
 * passed to {@link render}).
 *
 * The returned `columns` and `rows` are reactive — components that
 * destructure them will automatically re-render when the terminal is
 * resized.  This is implemented via `useSyncExternalStore` under the
 * hood, subscribing to the same resize event that drives
 * {@link useMediaQuery}.
 *
 * @example
 * ```tsx
 * const { exit, columns, rows } = useApp();
 *
 * <Text>Terminal size: {columns}×{rows}</Text>
 * <Button label="Quit" onPress={() => exit()} />
 * ```
 * @category Hooks
 */
export function useApp(): UseAppResult {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within a Glyph render tree");
  }

  // Subscribe to resize events so that `columns` / `rows` trigger a
  // React re-render when the terminal dimensions change.
  const subscribe = useCallback(
    (cb: () => void) => ctx.onResize(cb),
    [ctx],
  );

  const getColumns = useCallback(() => ctx.columns, [ctx]);
  const getRows = useCallback(() => ctx.rows, [ctx]);

  const columns = useSyncExternalStore(subscribe, getColumns);
  const rows = useSyncExternalStore(subscribe, getRows);

  return {
    exit: ctx.exit,
    forceRedraw: ctx.forceRedraw,
    columns,
    rows,
  };
}
