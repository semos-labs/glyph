import type { Cell } from "./framebuffer.js";
import { Framebuffer } from "./framebuffer.js";
import { colorToFg, colorToBg } from "./color.js";
import { ttyCharWidth } from "../utils/ttyWidth.js";
import { framePerf as perf } from "../perf.js";

const ESC = "\x1b";
const CSI = `${ESC}[`;

// ── Pre-allocated output buffer ─────────────────────────────────
// Reused across frames to avoid per-frame allocation.  Grows as
// needed, never shrinks.  We build all escape sequences + text into
// this buffer and return a string at the very end via toString().

let buf = Buffer.allocUnsafe(1 << 16); // 64 KB initial
let off = 0;

function ensureCapacity(bytes: number): void {
  if (off + bytes > buf.length) {
    const next = Buffer.allocUnsafe(Math.max(buf.length << 1, off + bytes));
    buf.copy(next, 0, 0, off);
    buf = next;
  }
}

/** Write a known-ASCII string (escape sequences, digits). latin1 = 1 byte/char. */
function writeAscii(s: string): void {
  ensureCapacity(s.length);
  off += buf.write(s, off, "latin1");
}

/** Write an arbitrary (possibly multi-byte) character string. */
function writeStr(s: string): void {
  const needed = Buffer.byteLength(s, "utf8");
  ensureCapacity(needed);
  off += buf.write(s, off, "utf8");
}

// ── Escape sequence helpers ─────────────────────────────────────

function writeCursorMove(x: number, y: number): void {
  writeAscii(`${CSI}${y + 1};${x + 1}H`);
}

function buildSGR(cell: Cell): string {
  let seq = `${CSI}0m`;
  if (cell.bold) seq += `${CSI}1m`;
  if (cell.dim) seq += `${CSI}2m`;
  if (cell.italic) seq += `${CSI}3m`;
  if (cell.underline) seq += `${CSI}4m`;
  if (cell.fg != null) seq += colorToFg(cell.fg);
  if (cell.bg != null) seq += colorToBg(cell.bg);
  return seq;
}

// ── Public API ──────────────────────────────────────────────────

export interface CursorState {
  /** Whether the cursor should be visible after this frame. */
  visible: boolean;
  /** Target x position (0-indexed). Only used when visible=true. */
  x?: number;
  /** Target y position (0-indexed). Only used when visible=true. */
  y?: number;
  /** OSC 12 color string for cursor. */
  color?: string;
  /** Whether cursor was visible before this frame. */
  wasVisible: boolean;
  /** Previous x (to skip redundant repositioning). */
  prevX: number;
  /** Previous y (to skip redundant repositioning). */
  prevY: number;
  /** Previous color (to skip redundant OSC 12). */
  prevColor: string;
}

export function diffFramebuffers(
  prev: Framebuffer,
  next: Framebuffer,
  fullRedraw: boolean,
  cursor?: CursorState,
): string {
  off = 0; // Reset write cursor

  // Begin synchronized update (DEC mode 2026).
  // Terminal buffers all output and paints atomically on end marker.
  // Supported by Ghostty, Kitty, WezTerm, iTerm2, foot, Contour, etc.
  // Unsupported terminals silently ignore these sequences.
  writeAscii(`${CSI}?2026h`);

  // Always hide cursor at the start of the sync block.
  // This ensures the cursor isn't visible at intermediate positions
  // during cell writes. We'll show it at the final position at the end.
  if (cursor?.wasVisible) {
    writeAscii(`${CSI}?25l`);
  }

  // cursorX/cursorY track the terminal's ACTUAL cursor position,
  // accounting for wide characters that advance the cursor by 2.
  let cursorX = -1;
  let cursorY = -1;
  let lastSGR = "";

  // Disable auto-wrap on EVERY frame, not just full redraws.
  // When auto-wrap is on and we write the last column, terminals enter a
  // "pending-wrap" or "deferred-wrap" state.  The exact behavior differs:
  //   • WezTerm: pending wrap is cleanly cancelled by the next CUP move.
  //   • Kitty/Ghostty: pending wrap can corrupt cursor positioning when
  //     combined with DEC 2026 synchronized output, especially during
  //     rapid incremental updates (e.g. sliding window with unique keys).
  // Disabling auto-wrap avoids the issue entirely.  We re-enable it
  // at the end of the sync block so image rendering and native cursor
  // behavior work normally between frames.
  writeAscii(`${CSI}?7l`);

  if (fullRedraw) {
    // On full redraw (resize, first paint, force-redraw):
    //  1. Reset scroll region — removes any stale scroll-region that
    //     could clip output.
    //  2. Clear entire screen (\x1b[2J) — this is significantly more
    //     robust than per-line \x1b[2K after a resize.  When a terminal
    //     shrinks, many emulators wrap/reflow existing alt-screen content,
    //     creating logical multi-row lines.  Per-line erase may only
    //     erase the logical line, leaving wrapped remnants.  \x1b[2J
    //     nukes everything unconditionally.
    //  3. Home cursor — ensure we start from (0,0).
    writeAscii(`${CSI}r`);   // Reset scroll region
    writeAscii(`${CSI}2J`);  // Clear entire screen
    writeAscii(`${CSI}H`);   // Home cursor
    cursorX = 0;
    cursorY = 0;
  }

  const tLoop0 = performance.now();
  let cellsTotal = 0;
  let cellsChanged = 0;
  let cursorMovesCount = 0;
  let sgrChangesCount = 0;

  for (let y = 0; y < next.height; y++) {
    for (let x = 0; x < next.width; x++) {
      const nc = next.get(x, y)!;

      // Skip continuation cells — these are the trailing half of a wide
      // character (CJK / emoji).  The leading cell already wrote the full
      // glyph and advanced the terminal cursor past this column.
      if (nc.ch === "") continue;
      cellsTotal++;

      if (!fullRedraw) {
        const pc = prev.get(x, y);
        if (pc && next.cellsEqual(nc, pc)) continue;
      }
      cellsChanged++;

      // Move cursor if it isn't already at the right position
      if (cursorY !== y || cursorX !== x) {
        writeCursorMove(x, y);
        cursorMovesCount++;
      }

      const sgr = buildSGR(nc);
      if (sgr !== lastSGR) {
        writeAscii(sgr);
        lastSGR = sgr;
        sgrChangesCount++;
      }

      writeStr(nc.ch);
      // Advance cursor by the character's actual display width.
      // Wide characters (CJK, certain Unicode) move the cursor by 2.
      cursorX = x + ttyCharWidth(nc.ch);
      cursorY = y;
    }
  }
  perf.diffLoop = performance.now() - tLoop0;
  perf.cellsTotal = cellsTotal;
  perf.cellsChanged = cellsChanged;
  perf.cursorMoves = cursorMovesCount;
  perf.sgrChanges = sgrChangesCount;

  if (off > 0) {
    writeAscii(`${CSI}0m`);
  }

  // Re-enable auto-wrap so normal terminal behaviour is preserved
  // for anything outside our paint cycle (e.g. images, cursor input).
  writeAscii(`${CSI}?7h`);

  // ── Cursor handling (end of sync block) ──
  if (cursor) {
    if (cursor.visible && cursor.x !== undefined && cursor.y !== undefined) {
      // Set color only if changed
      if (cursor.color && cursor.color !== cursor.prevColor) {
        writeAscii(`\x1b]12;${cursor.color}\x07`);
      }
      // Position cursor at target
      writeAscii(`${CSI}${cursor.y + 1};${cursor.x + 1}H`);
      // Show cursor (was hidden at start of sync block)
      writeAscii(`${CSI}?25h`);
    } else if (!cursor.visible && cursor.wasVisible) {
      // Cursor was hidden at start, keep it hidden (no-op, already hidden)
    }
    // If !wasVisible && !visible: cursor stays hidden (no-op)
  }

  // End synchronized update — terminal paints everything at once.
  // writeAscii(`${CSI}?2026l`); // DISABLED: testing DEC 2026 off

  // Track output size for diagnostics (helps detect frames that might
  // overwhelm a terminal's sync buffer).
  perf.outputBytes = off;

  // Return a string — no API change.  All escape sequences are pure
  // ASCII so the mixed latin1/utf8 buffer is valid utf8 throughout.
  const tStr0 = performance.now();
  const result = buf.toString("utf8", 0, off);
  perf.diffToString = performance.now() - tStr0;
  return result;
}
