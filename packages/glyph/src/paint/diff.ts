import type { Cell } from "./framebuffer.js";
import { Framebuffer } from "./framebuffer.js";
import { colorToFg, colorToBg } from "./color.js";
import { ttyCharWidth } from "../utils/ttyWidth.js";

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

export function diffFramebuffers(
  prev: Framebuffer,
  next: Framebuffer,
  fullRedraw: boolean,
): string {
  off = 0; // Reset write cursor

  // cursorX/cursorY track the terminal's ACTUAL cursor position,
  // accounting for wide characters that advance the cursor by 2.
  let cursorX = -1;
  let cursorY = -1;
  let lastSGR = "";

  if (fullRedraw) {
    // On full redraw (resize, first paint, force-redraw):
    //  1. Disable auto-wrap — prevents the cursor from wrapping to the
    //     next line when we write the very last column.  Some terminals
    //     enter "pending-wrap" state which can interact badly with cursor
    //     repositioning after resize.
    //  2. Reset scroll region — removes any stale scroll-region that
    //     could clip output.
    //  3. Clear entire screen (\x1b[2J) — this is significantly more
    //     robust than per-line \x1b[2K after a resize.  When a terminal
    //     shrinks, many emulators wrap/reflow existing alt-screen content,
    //     creating logical multi-row lines.  Per-line erase may only
    //     erase the logical line, leaving wrapped remnants.  \x1b[2J
    //     nukes everything unconditionally.
    //  4. Home cursor — ensure we start from (0,0).
    writeAscii(`${CSI}?7l`); // Disable auto-wrap
    writeAscii(`${CSI}r`);   // Reset scroll region
    writeAscii(`${CSI}2J`);  // Clear entire screen
    writeAscii(`${CSI}H`);   // Home cursor
    cursorX = 0;
    cursorY = 0;
  }

  for (let y = 0; y < next.height; y++) {
    for (let x = 0; x < next.width; x++) {
      const nc = next.get(x, y)!;

      // Skip continuation cells — these are the trailing half of a wide
      // character (CJK / emoji).  The leading cell already wrote the full
      // glyph and advanced the terminal cursor past this column.
      if (nc.ch === "") continue;

      if (!fullRedraw) {
        const pc = prev.get(x, y);
        if (pc && next.cellsEqual(nc, pc)) continue;
      }

      // Move cursor if it isn't already at the right position
      if (cursorY !== y || cursorX !== x) {
        writeCursorMove(x, y);
      }

      const sgr = buildSGR(nc);
      if (sgr !== lastSGR) {
        writeAscii(sgr);
        lastSGR = sgr;
      }

      writeStr(nc.ch);
      // Advance cursor by the character's actual display width.
      // Wide characters (CJK, certain Unicode) move the cursor by 2.
      cursorX = x + ttyCharWidth(nc.ch);
      cursorY = y;
    }
  }

  if (off > 0) {
    writeAscii(`${CSI}0m`);
  }

  if (fullRedraw) {
    // Re-enable auto-wrap so normal terminal behaviour is preserved
    // for anything outside our paint cycle (e.g. images, cursor input).
    writeAscii(`${CSI}?7h`);
  }

  // Return a string — no API change.  All escape sequences are pure
  // ASCII so the mixed latin1/utf8 buffer is valid utf8 throughout.
  return buf.toString("utf8", 0, off);
}
