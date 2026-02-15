import type { Cell } from "./framebuffer.js";
import { Framebuffer } from "./framebuffer.js";
import { colorToFg, colorToBg } from "./color.js";
import stringWidth from "string-width";

const ESC = "\x1b";
const CSI = `${ESC}[`;

function moveCursor(x: number, y: number): string {
  return `${CSI}${y + 1};${x + 1}H`;
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

/**
 * Compute the display width of a single cell character.
 * Fast-paths ASCII (charCode < 128 → always width 1) and only
 * calls stringWidth for non-ASCII to keep the diff tight.
 */
function cellWidth(ch: string): number {
  if (ch.length === 0) return 0;
  // ASCII fast path (covers the vast majority of cells)
  if (ch.length === 1 && ch.charCodeAt(0) < 128) return 1;
  return stringWidth(ch) || 1;
}

export function diffFramebuffers(
  prev: Framebuffer,
  next: Framebuffer,
  fullRedraw: boolean,
): string {
  let out = "";
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
    out += `${CSI}?7l`; // Disable auto-wrap
    out += `${CSI}r`;   // Reset scroll region
    out += `${CSI}2J`;  // Clear entire screen
    out += `${CSI}H`;   // Home cursor
    cursorX = 0;
    cursorY = 0;
  }

  for (let y = 0; y < next.height; y++) {
    for (let x = 0; x < next.width; x++) {
      const nc = next.get(x, y)!;
      if (!fullRedraw) {
        const pc = prev.get(x, y);
        if (pc && next.cellsEqual(nc, pc)) continue;
      }

      // Move cursor if it isn't already at the right position
      if (cursorY !== y || cursorX !== x) {
        out += moveCursor(x, y);
      }

      const sgr = buildSGR(nc);
      if (sgr !== lastSGR) {
        out += sgr;
        lastSGR = sgr;
      }

      out += nc.ch;
      // Advance cursor by the character's actual display width.
      // Wide characters (CJK, certain Unicode) move the cursor by 2.
      cursorX = x + cellWidth(nc.ch);
      cursorY = y;
    }
  }

  if (out.length > 0) {
    out += `${CSI}0m`;
  }

  if (fullRedraw) {
    // Re-enable auto-wrap so normal terminal behaviour is preserved
    // for anything outside our paint cycle (e.g. images, cursor input).
    out += `${CSI}?7h`;
  }

  return out;
}
