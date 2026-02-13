import React from "react";

/**
 * Props for the {@link Spacer} component.
 */
export interface SpacerProps {
  /** Flex grow factor. Default `1`. Set higher values to take proportionally more space. */
  size?: number;
}

/**
 * Flexible spacer that pushes siblings apart.
 *
 * Renders an invisible `Box` with `flexGrow`. Drop it between elements
 * in a row or column to push them to opposite edges, or use multiple
 * spacers to distribute space evenly.
 *
 * @example
 * ```tsx
 * // Push "Save" to the right edge
 * <Box style={{ flexDirection: "row" }}>
 *   <Text>Title</Text>
 *   <Spacer />
 *   <Button label="Save" onPress={save} />
 * </Box>
 * ```
 */
export function Spacer({ size }: SpacerProps): React.JSX.Element {
  return React.createElement("box" as any, {
    style: { flexGrow: size ?? 1 },
  });
}
