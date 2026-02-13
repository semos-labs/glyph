import React, { useState, useEffect } from "react";
import type { Style } from "../types/index.js";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Props for the {@link Spinner} component.
 */
export interface SpinnerProps {
  /** Animation frames. Defaults to braille dots. */
  frames?: string[];
  /** Interval between frames in ms. Default 80. */
  intervalMs?: number;
  /** Optional label text next to the spinner. */
  label?: string;
  /** Style applied to the spinner character. */
  style?: Style;
}

/**
 * Animated spinner indicator.
 *
 * Uses braille dot characters by default, cycling at 80 ms per frame.
 * Supply custom `frames` for different animation styles.
 *
 * @example
 * ```tsx
 * <Spinner label="Loading..." style={{ color: "cyan" }} />
 * ```
 *
 * @example
 * ```tsx
 * // Custom frames
 * <Spinner frames={["◐", "◓", "◑", "◒"]} intervalMs={120} />
 * ```
 */
export function Spinner({
  frames = BRAILLE_FRAMES,
  intervalMs = 80,
  label,
  style,
}: SpinnerProps): React.JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [frames.length, intervalMs]);

  const children: React.ReactNode[] = [
    React.createElement("text" as any, { key: "frame", style }, frames[frameIndex]),
  ];

  if (label) {
    children.push(
      React.createElement("text" as any, { key: "label", style: {} }, " " + label),
    );
  }

  return React.createElement(
    "box" as any,
    { style: { flexDirection: "row" as const } },
    ...children,
  );
}
