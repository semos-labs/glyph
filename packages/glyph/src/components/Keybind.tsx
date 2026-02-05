import { useContext, useEffect, useRef } from "react";
import { InputContext, FocusContext } from "../hooks/context.js";
import type { Key } from "../types/index.js";

export interface KeybindProps {
  /** Key descriptor, e.g. "q", "escape", "ctrl+c", "ctrl+shift+a" */
  keypress: string;
  /** Handler called when the key matches */
  onPress: () => void;
  /** Only fire when this focus ID is active */
  whenFocused?: string;
  /** Only fire when nothing is focused or the focused element doesn't consume the key */
  global?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

interface KeyMatcher {
  name: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

function parseKeyDescriptor(descriptor: string): KeyMatcher {
  const parts = descriptor.toLowerCase().split("+");
  const name = parts[parts.length - 1]!;
  return {
    name,
    ctrl: parts.includes("ctrl"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };
}

function matchesKey(matcher: KeyMatcher, key: Key): boolean {
  if (key.name !== matcher.name) return false;
  if (matcher.ctrl !== !!key.ctrl) return false;
  if (matcher.alt !== !!key.alt) return false;
  if (matcher.shift !== !!key.shift) return false;
  return true;
}

export function Keybind({
  keypress,
  onPress,
  whenFocused,
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

    const handler = (key: Key) => {
      if (!matchesKey(matcherRef.current, key)) return;

      // If whenFocused is specified, only fire when that ID is focused
      if (whenFocused && focusCtx?.focusedId !== whenFocused) return;

      onPressRef.current();
    };

    return inputCtx.subscribe(handler);
  }, [inputCtx, focusCtx, whenFocused, disabled]);

  return null;
}
