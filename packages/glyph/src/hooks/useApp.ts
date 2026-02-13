import { useContext } from "react";
import { AppContext } from "./context.js";

/**
 * Return type of {@link useApp}.
 */
export interface UseAppResult {
  /** Terminate the application, optionally with an exit code. */
  exit(code?: number): void;
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
 * @example
 * ```tsx
 * const { exit, columns, rows } = useApp();
 *
 * <Text>Terminal size: {columns}×{rows}</Text>
 * <Button label="Quit" onPress={() => exit()} />
 * ```
 */
export function useApp(): UseAppResult {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within a Glyph render tree");
  }

  return {
    exit: ctx.exit,
    get columns() {
      return ctx.columns;
    },
    get rows() {
      return ctx.rows;
    },
  };
}
