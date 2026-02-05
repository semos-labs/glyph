import type { Color, NamedColor, RGBColor } from "../types/index.js";

const NAMED_FG: Record<NamedColor, string> = {
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  blackBright: "\x1b[90m",
  redBright: "\x1b[91m",
  greenBright: "\x1b[92m",
  yellowBright: "\x1b[93m",
  blueBright: "\x1b[94m",
  magentaBright: "\x1b[95m",
  cyanBright: "\x1b[96m",
  whiteBright: "\x1b[97m",
};

const NAMED_BG: Record<NamedColor, string> = {
  black: "\x1b[40m",
  red: "\x1b[41m",
  green: "\x1b[42m",
  yellow: "\x1b[43m",
  blue: "\x1b[44m",
  magenta: "\x1b[45m",
  cyan: "\x1b[46m",
  white: "\x1b[47m",
  blackBright: "\x1b[100m",
  redBright: "\x1b[101m",
  greenBright: "\x1b[102m",
  yellowBright: "\x1b[103m",
  blueBright: "\x1b[104m",
  magentaBright: "\x1b[105m",
  cyanBright: "\x1b[106m",
  whiteBright: "\x1b[107m",
};

function parseHex(hex: string): RGBColor {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

export function colorToFg(color: Color): string {
  if (typeof color === "string") {
    if (color.startsWith("#")) {
      const { r, g, b } = parseHex(color);
      return `\x1b[38;2;${r};${g};${b}m`;
    }
    return NAMED_FG[color as NamedColor] ?? "\x1b[39m";
  }
  if (typeof color === "number") {
    return `\x1b[38;5;${color}m`;
  }
  const { r, g, b } = color;
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function colorToFgRaw(color: Color): [number, number, number] | null {
  if (typeof color === "string") {
    if (color.startsWith("#")) {
      const c = parseHex(color);
      return [c.r, c.g, c.b];
    }
    return null;
  }
  if (typeof color === "number") {
    return null;
  }
  return [color.r, color.g, color.b];
}

export function colorToBg(color: Color): string {
  if (typeof color === "string") {
    if (color.startsWith("#")) {
      const { r, g, b } = parseHex(color);
      return `\x1b[48;2;${r};${g};${b}m`;
    }
    return NAMED_BG[color as NamedColor] ?? "\x1b[49m";
  }
  if (typeof color === "number") {
    return `\x1b[48;5;${color}m`;
  }
  const { r, g, b } = color;
  return `\x1b[48;2;${r};${g};${b}m`;
}

// Approximate RGB fallbacks for the 16 ANSI colors (used until terminal palette is queried)
const NAMED_RGB: Record<NamedColor, [number, number, number]> = {
  black: [0, 0, 0],
  red: [170, 0, 0],
  green: [0, 170, 0],
  yellow: [170, 170, 0],
  blue: [0, 0, 170],
  magenta: [170, 0, 170],
  cyan: [0, 170, 170],
  white: [170, 170, 170],
  blackBright: [85, 85, 85],
  redBright: [255, 85, 85],
  greenBright: [85, 255, 85],
  yellowBright: [255, 255, 85],
  blueBright: [85, 85, 255],
  magentaBright: [255, 85, 255],
  cyanBright: [85, 255, 255],
  whiteBright: [255, 255, 255],
};

const NAMED_INDEX: NamedColor[] = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "blackBright", "redBright", "greenBright", "yellowBright", "blueBright", "magentaBright", "cyanBright", "whiteBright",
];

// Terminal-reported palette overrides the fallback approximations
let terminalPalette: Map<number, [number, number, number]> | null = null;

export function setTerminalPalette(palette: Map<number, [number, number, number]>): void {
  if (palette.size > 0) {
    terminalPalette = palette;
  }
}

function resolveNamedRgb(name: NamedColor): [number, number, number] | null {
  // Prefer terminal-reported values if available
  if (terminalPalette) {
    const idx = NAMED_INDEX.indexOf(name);
    if (idx !== -1) {
      const tp = terminalPalette.get(idx);
      if (tp) return tp;
    }
  }
  return NAMED_RGB[name] ?? null;
}

export function colorToRgb(color: Color): [number, number, number] | null {
  if (typeof color === "string") {
    if (color.startsWith("#")) {
      const c = parseHex(color);
      return [c.r, c.g, c.b];
    }
    return resolveNamedRgb(color as NamedColor);
  }
  if (typeof color === "number") {
    if (color < 16) {
      // Use terminal palette or fallback
      if (terminalPalette) {
        const tp = terminalPalette.get(color);
        if (tp) return tp;
      }
      return NAMED_RGB[NAMED_INDEX[color]!];
    }
    if (color >= 232) {
      const g = (color - 232) * 10 + 8;
      return [g, g, g];
    }
    // 216-color cube (indices 16-231)
    const idx = color - 16;
    const b = (idx % 6) * 51;
    const g = (Math.floor(idx / 6) % 6) * 51;
    const r = Math.floor(idx / 36) * 51;
    return [r, g, b];
  }
  return [color.r, color.g, color.b];
}

/** Returns true if the color is perceptually light (should use dark text on it). */
export function isLightColor(color: Color): boolean {
  const rgb = colorToRgb(color);
  if (!rgb) return false;
  // W3C relative luminance formula
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.4;
}

export function colorsEqual(
  a: Color | undefined,
  b: Color | undefined,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "object" && typeof b === "object") {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }
  return false;
}
