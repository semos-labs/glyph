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
 * In **determinate** mode the filled / empty proportions are rendered
 * as two {@link Box} elements whose widths are controlled by Yoga
 * (percentage + flexGrow).  This means the bar resizes instantly on
 * terminal resize with no extra React render cycle.
 *
 * In **indeterminate** mode the marquee animation uses {@link useLayout}
 * to read the exact track width.  The 100 ms animation timer provides
 * frequent re-renders so any stale value is corrected quickly.
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
 * @category Components
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
  // ---- Indeterminate-only state ----
  const trackRef = useRef<GlyphNode | null>(null);
  const trackLayout = useLayout(
    indeterminate && value === undefined ? trackRef : undefined,
  );
  const trackWidth = trackLayout.innerWidth;

  const [indeterminatePos, setIndeterminatePos] = useState(0);

  useEffect(() => {
    if (!indeterminate) return;
    const timer = setInterval(() => {
      setIndeterminatePos((p) => (p + 1) % Math.max(1, trackWidth + 6));
    }, 100);
    return () => clearInterval(timer);
  }, [indeterminate, trackWidth]);

  // ---- Shared ----
  const clamped = Math.max(0, Math.min(1, value ?? 0));
  const pctText = showPercent ? ` ${Math.round(clamped * 100)}%` : "";

  const children: React.ReactNode[] = [];

  if (label) {
    children.push(
      React.createElement("text" as any, { key: "label", style: { bold: true } }, label + " "),
    );
  }

  if (indeterminate && value === undefined) {
    // ---- Indeterminate (marquee) — text-based, needs exact track width ----
    let barText = "";
    if (trackWidth > 0) {
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
  } else {
    // ---- Determinate — single track box with bg = empty color ----
    // The filled portion is a child box sized by percentage width.
    // The empty portion is simply the track background showing through.
    // This avoids Yoga rounding gaps between two sibling boxes.
    const filledPct = Math.round(clamped * 100);
    const filledBg = style?.color ?? "white";
    const emptyBg = { r: 60, g: 60, b: 60 };

    children.push(
      React.createElement(
        "box" as any,
        {
          key: "track",
          style: {
            flexGrow: 1,
            flexShrink: 1,
            height: 1,
            bg: emptyBg,
          },
        },
        filledPct > 0
          ? React.createElement(
              "box" as any,
              { key: "filled", style: { width: `${filledPct}%`, height: 1, bg: filledBg } },
            )
          : undefined,
      ),
    );
  }

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
