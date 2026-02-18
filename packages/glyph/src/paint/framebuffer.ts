import type { Color } from "../types/index.js";
import { colorsEqual } from "./color.js";

export interface Cell {
  ch: string;
  fg?: Color;
  bg?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export class Framebuffer {
  width: number;
  height: number;
  cells: Cell[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Framebuffer.allocCells(width * height);
  }

  /** Create the initial cell array — the ONLY place new Cell objects are born. */
  private static allocCells(count: number): Cell[] {
    const cells = new Array<Cell>(count);
    for (let i = 0; i < count; i++) {
      cells[i] = { ch: " ", fg: undefined, bg: undefined, bold: false, dim: false, italic: false, underline: false };
    }
    return cells;
  }

  /** Reset every cell to a blank space — mutates in place, zero allocations. */
  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i]!;
      c.ch = " ";
      c.fg = undefined;
      c.bg = undefined;
      c.bold = false;
      c.dim = false;
      c.italic = false;
      c.underline = false;
    }
  }

  resize(width: number, height: number): void {
    const needed = width * height;
    this.width = width;
    this.height = height;
    if (this.cells.length !== needed) {
      this.cells = Framebuffer.allocCells(needed);
    } else {
      this.clear();
    }
  }

  get(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  set(x: number, y: number, cell: Cell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const c = this.cells[y * this.width + x]!;
    c.ch = cell.ch;
    c.fg = cell.fg;
    c.bg = cell.bg;
    c.bold = cell.bold ?? false;
    c.dim = cell.dim ?? false;
    c.italic = cell.italic ?? false;
    c.underline = cell.underline ?? false;
  }

  setChar(
    x: number,
    y: number,
    ch: string,
    fg?: Color,
    bg?: Color,
    bold?: boolean,
    dim?: boolean,
    italic?: boolean,
    underline?: boolean,
  ): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const c = this.cells[y * this.width + x]!;
    c.ch = ch;
    c.fg = fg;
    c.bg = bg;
    c.bold = bold ?? false;
    c.dim = dim ?? false;
    c.italic = italic ?? false;
    c.underline = underline ?? false;
  }

  fillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    ch: string,
    fg?: Color,
    bg?: Color,
  ): void {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        this.setChar(col, row, ch, fg, bg);
      }
    }
  }

  /** Copy all cell data from `src` into this framebuffer. Zero allocations. */
  copyFrom(src: Framebuffer): void {
    if (this.width !== src.width || this.height !== src.height) {
      this.resize(src.width, src.height);
    }
    const len = this.cells.length;
    for (let i = 0; i < len; i++) {
      const s = src.cells[i]!;
      const d = this.cells[i]!;
      d.ch = s.ch;
      d.fg = s.fg;
      d.bg = s.bg;
      d.bold = s.bold;
      d.dim = s.dim;
      d.italic = s.italic;
      d.underline = s.underline;
    }
  }

  clone(): Framebuffer {
    const fb = new Framebuffer(this.width, this.height);
    fb.copyFrom(this);
    return fb;
  }

  cellsEqual(a: Cell, b: Cell): boolean {
    return (
      a.ch === b.ch &&
      colorsEqual(a.fg, b.fg) &&
      colorsEqual(a.bg, b.bg) &&
      (a.bold ?? false) === (b.bold ?? false) &&
      (a.dim ?? false) === (b.dim ?? false) &&
      (a.italic ?? false) === (b.italic ?? false) &&
      (a.underline ?? false) === (b.underline ?? false)
    );
  }
}
