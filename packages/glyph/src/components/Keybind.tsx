import { useContext, useEffect, useRef } from "react";
import { InputContext, FocusContext } from "../hooks/context.js";
import type { Key } from "../types/index.js";

/**
 * Props for the {@link Keybind} component.
 */
export interface KeybindProps {
  /** Key descriptor, e.g. "q", "escape", "ctrl+c", "ctrl+shift+a" */
  keypress: string;
  /** Handler called when the key matches */
  onPress: () => void;
  /** Only fire when this focus ID is active */
  whenFocused?: string;
  /** Only fire when nothing is focused or the focused element doesn't consume the key */
  global?: boolean;
  /** 
   * If true, this keybind runs BEFORE focused input handlers.
   * Use for keybinds that should work even when an Input is focused (e.g., Ctrl+Enter to submit).
   */
  priority?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

interface KeyMatcher {
  name: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

function parseKeyDescriptor(descriptor: string): KeyMatcher {
  const parts = descriptor.toLowerCase().split("+");
  const name = parts[parts.length - 1]!;
  return {
    name,
    ctrl: parts.includes("ctrl"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("super") || parts.includes("win"),
  };
}

function matchesKey(matcher: KeyMatcher, key: Key): boolean {
  if (key.name !== matcher.name) return false;
  if (matcher.ctrl !== !!key.ctrl) return false;
  if (matcher.alt !== !!key.alt) return false;
  if (matcher.shift !== !!key.shift) return false;
  if (matcher.meta !== !!key.meta) return false;
  return true;
}

/**
 * Declarative keyboard shortcut handler (renders nothing).
 *
 * Add `<Keybind>` anywhere in your tree to react to specific key
 * combinations. Supports modifier keys (`ctrl`, `alt`, `shift`, `meta`)
 * and a `priority` flag to run before focused input handlers.
 *
 * @example
 * ```tsx
 * // Global quit shortcut
 * <Keybind keypress="ctrl+q" onPress={() => exit()} />
 * ```
 *
 * @example
 * ```tsx
 * // Priority keybind that fires even when an Input is focused
 * <Keybind keypress="ctrl+enter" onPress={submit} priority />
 * ```
 *
 * @example
 * ```tsx
 * // Only fires when a specific element is focused
 * <Keybind keypress="delete" onPress={handleDelete} whenFocused={itemFocusId} />
 * ```
 */
export function Keybind({
  keypress,
  onPress,
  whenFocused,
  priority,
  disabled,
}: KeybindProps): null {
  const inputCtx = useContext(InputContext);
  const focusCtx = useContext(FocusContext);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const matcherRef = useRef<KeyMatcher>(parseKeyDescriptor(keypress));
  matcherRef.current = parseKeyDescriptor(keypress);

  useEffect(() => {
    if (!inputCtx || disabled) return;

    if (priority) {
      // Priority handler - runs before focused input handlers
      const handler = (key: Key): boolean => {
        if (!matchesKey(matcherRef.current, key)) return false;

        // If whenFocused is specified, only fire when that ID is focused
        if (whenFocused && focusCtx?.focusedId !== whenFocused) return false;

        onPressRef.current();
        return true; // Consumed - prevent further propagation
      };

      return inputCtx.subscribePriority(handler);
    } else {
      // Normal handler - runs after focused input handlers (if not consumed)
      const handler = (key: Key) => {
        if (!matchesKey(matcherRef.current, key)) return;

        // If whenFocused is specified, only fire when that ID is focused
        if (whenFocused && focusCtx?.focusedId !== whenFocused) return;

        onPressRef.current();
      };

      return inputCtx.subscribe(handler);
    }
  }, [inputCtx, focusCtx, whenFocused, priority, disabled]);

  return null;
}
