import React, { useRef, useMemo } from "react";
import type { Style, Color } from "../types/index.js";
import { useApp } from "../hooks/useApp.js";
import { Box } from "./Box.js";
import { Text } from "./Text.js";

// ── Helpers ──────────────────────────────────────────────────────

const SPARKLINE_CHARS = " ▁▂▃▄▅▆▇█";
const HISTORY_LEN = 24;

function buildSparkline(values: number[], max: number): string {
  return values
    .map((v) => {
      const idx = Math.round((Math.min(v, max) / max) * 8);
      return SPARKLINE_CHARS[idx] ?? " ";
    })
    .join("");
}

function fmtMs(ms: number): string {
  if (ms < 0.01) return "0.00";
  if (ms < 10) return ms.toFixed(2);
  return ms.toFixed(1);
}

// ── Props ────────────────────────────────────────────────────────

/**
 * Props for the {@link DebugOverlay} component.
 */
export interface DebugOverlayProps {
  /** Show per-phase breakdown (layout / paint / diff / swap). Defaults to `true`. */
  phases?: boolean;
  /** Show sparkline graph of recent frame times. Defaults to `true`. */
  sparkline?: boolean;
  /** Corner to anchor the overlay. Defaults to `"top-right"`. */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Override the default overlay style. Merged on top of the base style. */
  style?: Style;
}

// ── Component ────────────────────────────────────────────────────

/**
 * Floating debug HUD showing real-time rendering metrics.
 *
 * Renders as an absolute-positioned overlay in a chosen corner of the
 * screen.  Displays current frame time, average, and optionally a
 * per-phase breakdown and sparkline history — useful for profiling
 * without leaving the application.
 *
 * Respects the `debug` flag from `render(element, { debug: true })`.
 * When debug mode is off, this component renders nothing — safe to
 * leave in your tree unconditionally.
 *
 * @example
 * ```tsx
 * import { DebugOverlay } from "@semos-labs/glyph";
 *
 * function App() {
 *   return (
 *     <Box style={{ width: "100%", height: "100%" }}>
 *       <MyContent />
 *       <DebugOverlay />
 *     </Box>
 *   );
 * }
 * ```
 * @category Components
 */
export function DebugOverlay({
  phases = true,
  sparkline: showSparkline = true,
  position = "top-right",
  style: userStyle,
}: DebugOverlayProps) {
  const { lastFrameTime, frameTiming, debug } = useApp();

  // Only render when debug mode is enabled via render(element, { debug: true })
  if (!debug) return null;

  // ── History tracking ───────────────────────────────────────────
  const historyRef = useRef<number[]>([]);
  const statsRef = useRef({ min: Infinity, max: 0, sum: 0, count: 0 });

  if (lastFrameTime > 0) {
    const h = historyRef.current;
    h.push(lastFrameTime);
    if (h.length > HISTORY_LEN) h.shift();

    const s = statsRef.current;
    s.sum += lastFrameTime;
    s.count++;
    if (lastFrameTime < s.min) s.min = lastFrameTime;
    if (lastFrameTime > s.max) s.max = lastFrameTime;
  }

  const avg = statsRef.current.count > 0
    ? statsRef.current.sum / statsRef.current.count
    : 0;

  // ── Color coding ───────────────────────────────────────────────
  const color: Color = lastFrameTime < 3 ? "green" : lastFrameTime < 8 ? "yellow" : "red";

  // ── Sparkline ──────────────────────────────────────────────────
  const spark = useMemo(() => {
    const h = historyRef.current;
    if (h.length === 0) return "";
    const max = Math.max(...h, 1);
    return buildSparkline(h, max);
  }, [lastFrameTime]);

  // ── Layout ─────────────────────────────────────────────────────
  const isTop = position.startsWith("top");
  const isRight = position.endsWith("right");

  const positionStyle: Style = {
    position: "absolute",
    ...(isTop ? { top: 0 } : { bottom: 0 }),
    ...(isRight ? { right: 0 } : { left: 0 }),
  };

  const baseStyle: Style = {
    ...positionStyle,
    flexDirection: "column",
    bg: "black",
    paddingX: 1,
    zIndex: 9999,
  };

  const mergedStyle: Style = userStyle
    ? { ...baseStyle, ...userStyle }
    : baseStyle;

  return (
    <Box style={mergedStyle}>
      {/* Summary line */}
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ bold: true, color }}>
          {fmtMs(lastFrameTime)}ms
        </Text>
        <Text style={{ dim: true }}>avg</Text>
        <Text>{fmtMs(avg)}ms</Text>
      </Box>

      {/* Sparkline */}
      {showSparkline && historyRef.current.length > 1 && (
        <Text style={{ dim: true }}>{spark}</Text>
      )}

      {/* Per-phase breakdown */}
      {phases && (
        <Box style={{ flexDirection: "column" }}>
          <PhaseBar label="layout" ms={frameTiming.layout} avg={avg} color="yellow" />
          <PhaseBar label="paint" ms={frameTiming.paint} avg={avg} color="magenta" />
          <PhaseBar label="diff" ms={frameTiming.diff} avg={avg} color="cyan" />
          <PhaseBar label="swap" ms={frameTiming.swap} avg={avg} color="red" />
        </Box>
      )}
    </Box>
  );
}

// ── Internal sub-component ───────────────────────────────────────

function PhaseBar({ label, ms, avg, color }: { label: string; ms: number; avg: number; color: Color }) {
  const pct = avg > 0 ? Math.round((ms / avg) * 100) : 0;
  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      <Text style={{ width: 6, dim: true }}>{label}</Text>
      <Text style={{ color }}>{fmtMs(ms)}ms</Text>
      <Text style={{ dim: true }}>({pct}%)</Text>
    </Box>
  );
}
