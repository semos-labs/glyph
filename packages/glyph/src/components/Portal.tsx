import React from "react";
import type { ReactNode } from "react";

/**
 * Props for the {@link Portal} component.
 */
export interface PortalProps {
  /** Content to render in the overlay layer. */
  children?: ReactNode;
  /** Stack order (higher = on top). Default `1000`. */
  zIndex?: number;
}

/**
 * Renders children as a fullscreen absolute overlay on top of the main tree.
 *
 * Useful for modals, notifications, and dropdowns that should paint
 * above all other content.
 *
 * @example
 * ```tsx
 * {showModal && (
 *   <Portal>
 *     <Box style={{ justifyContent: "center", alignItems: "center", height: "100%" }}>
 *       <Box style={{ border: "round", padding: 2, bg: "black" }}>
 *         <Text>I'm an overlay!</Text>
 *       </Box>
 *     </Box>
 *   </Portal>
 * )}
 * ```
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
