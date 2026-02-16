import React from "react";
import { Keybind } from "./Keybind.js";
import type { KeybindRegistry } from "../utils/keybinds.js";

/**
 * Map of action identifiers to handler functions.
 *
 * Actions whose handler is `undefined` are skipped (no `Keybind` is rendered).
 *
 * @category Types
 */
export type ActionHandlers = Record<string, (() => void) | undefined>;

/**
 * Props for the {@link ScopedKeybinds} component.
 */
export interface ScopedKeybindsProps<S extends string = string> {
  /** The keybind registry to read from. */
  registry: KeybindRegistry<S>;
  /** Which scope to bind. */
  scope: S;
  /**
   * Map of action names to handler functions.
   * Only keybinds whose action has a truthy handler are bound.
   */
  handlers: ActionHandlers;
  /** Enable / disable all keybinds in this scope. Default `true`. */
  enabled?: boolean;
  /**
   * When `true`, keybinds run **before** focused-input handlers,
   * overriding duplicate keys from non-priority scopes.
   */
  priority?: boolean;
}

/**
 * Declarative keybind binding driven by a {@link KeybindRegistry} scope.
 *
 * Reads keybind definitions from the given `scope`, filters to those with a
 * matching handler, and renders a `<Keybind>` for each one. When `priority`
 * is set, all rendered keybinds fire before focused-input handlers, letting
 * them override duplicate keys from other scopes.
 *
 * @example
 * ```tsx
 * import { createKeybindRegistry, ScopedKeybinds } from "@semos-labs/glyph";
 *
 * const registry = createKeybindRegistry({
 *   global: [
 *     { key: "q", display: "q", description: "Quit", action: "quit" },
 *   ],
 *   list: [
 *     { key: "j", display: "j / ↓", description: "Next", action: "next" },
 *     { key: "down", display: "j / ↓", description: "Next", action: "next" },
 *   ],
 * });
 *
 * function MyList() {
 *   return (
 *     <ScopedKeybinds
 *       registry={registry}
 *       scope="list"
 *       handlers={{ next: () => moveDown(), prev: () => moveUp() }}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Priority keybinds override duplicate keys from other scopes
 * <ScopedKeybinds
 *   registry={registry}
 *   scope="dialog"
 *   handlers={{ confirm: save, cancel: close }}
 *   priority
 * />
 * ```
 * @category Components
 */
export function ScopedKeybinds<S extends string>({
  registry,
  scope,
  handlers,
  enabled = true,
  priority = false,
}: ScopedKeybindsProps<S>): React.JSX.Element | null {
  if (!enabled) return null;

  const keybinds = registry.scopes[scope] || [];

  return React.createElement(
    React.Fragment,
    null,
    ...keybinds
      .filter((kb) => kb.key && handlers[kb.action])
      .map((kb, i) =>
        React.createElement(Keybind, {
          key: `${scope as string}-${kb.key}-${i}`,
          keypress: kb.key,
          onPress: handlers[kb.action]!,
          priority,
        }),
      ),
  );
}
