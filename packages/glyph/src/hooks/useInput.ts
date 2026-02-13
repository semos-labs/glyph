import { useContext, useEffect } from "react";
import { InputContext } from "./context.js";
import type { Key } from "../types/index.js";

/**
 * Subscribe to raw keyboard input.
 *
 * The handler is called for **every** key press that is not consumed by a
 * focused input handler or a priority {@link Keybind}. This is the
 * lowest-level input hook — prefer `Keybind` for simple shortcuts and
 * component-level handlers for focused input.
 *
 * @param handler - Callback receiving the parsed {@link Key}.
 * @param deps - Dependency array (same semantics as `useEffect`).
 *
 * @example
 * ```tsx
 * useInput((key) => {
 *   if (key.name === "q" && !key.ctrl) exit();
 * });
 * ```
 */
export function useInput(
  handler: (key: Key) => void,
  deps: any[] = [],
): void {
  const ctx = useContext(InputContext);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, ...deps]);
}
