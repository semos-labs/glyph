import React from "react";
import type { ReactNode } from "react";

export interface PortalProps {
  children?: ReactNode;
  zIndex?: number;
}

/**
 * Portal renders children as a fullscreen absolute overlay on top of the main tree.
 * Useful for modals, notifications, and dropdowns that should paint above all other content.
 */
export function Portal({ children, zIndex = 1000 }: PortalProps): React.JSX.Element {
  return React.createElement(
    "box" as any,
    {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex,
      },
    },
    children,
  );
}
