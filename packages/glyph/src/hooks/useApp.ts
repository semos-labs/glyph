import { useContext } from "react";
import { AppContext } from "./context.js";

export interface UseAppResult {
  exit(code?: number): void;
  columns: number;
  rows: number;
}

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
