import React, { useRef, useState, useEffect } from "react";
import type { Style, DimensionValue } from "../types/index.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import { useLayout } from "../hooks/useLayout.js";

/**
 * Props for the {@link Progress} component.
 */
export interface ProgressProps {
  /** Progress value 0..1. Omit when indeterminate. */
  value?: number;
  /** Animate as indeterminate (marquee). Default false. */
  indeterminate?: boolean;
  /** Width of the progress bar. Default "100%". */
  width?: DimensionValue;
  /** Optional label text displayed before the bar. */
  label?: string;
  /** Show percentage text after the bar. Default false. */
  showPercent?: boolean;
  /** Outer container style. */
  style?: Style;
  /** Character(s) for the filled portion. Default "█". */
  filled?: string;
  /** Character(s) for the empty portion. Default "░". */
  empty?: string;
}

/**
 * Horizontal progress bar with determinate and indeterminate modes.
 *
 * @example
 * ```tsx
 * // Determinate progress
 * <Progress value={0.65} showPercent label="Downloading" />
 * ```
 *
 * @example
 * ```tsx
 * // Indeterminate marquee
 * <Progress indeterminate label="Loading..." />
 * ```
 */
export function Progress({
  value,
  indeterminate = false,
  width = "100%",
  label,
  showPercent = false,
  style,
  filled = "█",
  empty = "░",
}: ProgressProps): React.JSX.Element {
  const trackRef = useRef<GlyphNode | null>(null);
  const trackLayout = useLayout(trackRef);
  const trackWidth = trackLayout.innerWidth;

  // Indeterminate animation state
  const [indeterminatePos, setIndeterminatePos] = useState(0);

  useEffect(() => {
    if (!indeterminate) return;
    const timer = setInterval(() => {
      setIndeterminatePos((p) => (p + 1) % Math.max(1, trackWidth + 6));
    }, 100);
    return () => clearInterval(timer);
  }, [indeterminate, trackWidth]);

  const clamped = Math.max(0, Math.min(1, value ?? 0));
  const pctText = showPercent ? ` ${Math.round(clamped * 100)}%` : "";

  let barText = "";
  if (trackWidth > 0) {
    if (indeterminate && value === undefined) {
      // Marquee: a 3-char chunk bouncing across the track
      const chunkSize = Math.max(1, Math.min(3, Math.floor(trackWidth / 4)));
      const chars: string[] = [];
      for (let i = 0; i < trackWidth; i++) {
        if (i >= indeterminatePos - chunkSize && i < indeterminatePos) {
          chars.push(filled);
        } else {
          chars.push(empty);
        }
      }
      barText = chars.join("");
    } else {
      const filledCount = Math.round(clamped * trackWidth);
      barText = filled.repeat(filledCount) + empty.repeat(trackWidth - filledCount);
    }
  }

  const children: React.ReactNode[] = [];

  if (label) {
    children.push(
      React.createElement("text" as any, { key: "label", style: { bold: true } }, label + " "),
    );
  }

  children.push(
    React.createElement(
      "box" as any,
      {
        key: "track",
        style: { flexGrow: 1, flexShrink: 1 },
        ref: (node: any) => { trackRef.current = node ?? null; },
      },
      React.createElement("text" as any, { key: "bar", style: {} }, barText),
    ),
  );

  if (showPercent) {
    children.push(
      React.createElement("text" as any, { key: "pct", style: { bold: true } }, pctText),
    );
  }

  return React.createElement(
    "box" as any,
    {
      style: {
        flexDirection: "row" as const,
        width,
        ...style,
      },
    },
    ...children,
  );
}
