import React from "react";

export interface SpacerProps {
  size?: number;
}

export function Spacer({ size }: SpacerProps): React.JSX.Element {
  return React.createElement("box" as any, {
    style: { flexGrow: size ?? 1 },
  });
}
