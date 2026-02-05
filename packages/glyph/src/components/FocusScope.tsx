import React, { useContext, useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { FocusContext } from "../hooks/context.js";

export interface FocusScopeProps {
  trap?: boolean;
  children?: ReactNode;
}

export function FocusScope({ trap = false, children }: FocusScopeProps): React.JSX.Element {
  const focusCtx = useContext(FocusContext);
  const prevFocusRef = useRef<string | null>(null);
  const scopeIdsRef = useRef<Set<string>>(new Set());

  // Push trap during layout phase - this runs BEFORE children's useEffect,
  // so when children register in their useEffect, the trap is already active
  // and their IDs get added to scopeIdsRef.current
  useLayoutEffect(() => {
    if (!trap || !focusCtx) return;

    prevFocusRef.current = focusCtx.focusedId;
    const cleanup = focusCtx.pushTrap(scopeIdsRef.current);

    return () => {
      cleanup();
      // Restore previous focus when trap is removed
      if (prevFocusRef.current) {
        focusCtx.requestFocus(prevFocusRef.current);
      }
    };
  }, [trap, focusCtx]);

  // Focus first trapped item AFTER children have registered (useEffect runs after children's useEffect)
  useEffect(() => {
    if (!trap || !focusCtx) return;
    if (scopeIdsRef.current.size > 0) {
      const firstId = scopeIdsRef.current.values().next().value;
      if (firstId) focusCtx.requestFocus(firstId);
    }
  }, [trap, focusCtx]);

  return React.createElement(React.Fragment, null, children);
}
