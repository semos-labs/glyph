/** Named ANSI terminal color. */
export type NamedColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "blackBright"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright";

/** Hex color string (e.g. `"#ff00ff"`). */
export type HexColor = `#${string}`;

/** RGB color as an object with 0-255 channels. */
export type RGBColor = { r: number; g: number; b: number };

/**
 * Color value accepted by all style properties.
 *
 * - {@link NamedColor} — ANSI name (`"red"`, `"cyanBright"`, …)
 * - {@link HexColor} — hex string (`"#ff00ff"`)
 * - {@link RGBColor} — `{ r, g, b }` object
 * - `number` — ANSI 256-color index (0–255)
 */
export type Color = NamedColor | HexColor | RGBColor | number;

/**
 * Dimension value in terminal cells or a percentage string.
 * - `number` — absolute cells
 * - `"50%"` — percentage of parent
 */
export type DimensionValue = number | `${number}%`;

/** Border drawing style for {@link Style.border}. */
export type BorderStyle = "none" | "single" | "double" | "round" | "ascii";

/**
 * Text wrapping mode for {@link Style.wrap}.
 * - `"wrap"` — soft-wrap at container edge
 * - `"truncate"` — cut off silently
 * - `"ellipsis"` — cut off with `…`
 * - `"none"` — no wrapping
 */
export type WrapMode = "wrap" | "truncate" | "ellipsis" | "none";

/** Horizontal text alignment. */
export type TextAlign = "left" | "center" | "right";

/**
 * Unified style object for all Glyph elements.
 *
 * Combines CSS-like flexbox layout, positioning, paint (colors, borders),
 * and text formatting into a single flat object.
 */
export interface Style {
  // ── Layout ───────────────────────────────────────────────────
  /** Width in cells or percentage of parent. */
  width?: DimensionValue;
  /** Height in cells or percentage of parent. */
  height?: DimensionValue;
  /** Minimum width in cells. */
  minWidth?: number;
  /** Minimum height in cells. */
  minHeight?: number;
  /** Maximum width in cells. */
  maxWidth?: number;
  /** Maximum height in cells. */
  maxHeight?: number;
  /** Padding on all four sides (cells). */
  padding?: number;
  /** Horizontal padding (left + right). */
  paddingX?: number;
  /** Vertical padding (top + bottom). */
  paddingY?: number;
  /** Top padding. */
  paddingTop?: number;
  /** Right padding. */
  paddingRight?: number;
  /** Bottom padding. */
  paddingBottom?: number;
  /** Left padding. */
  paddingLeft?: number;
  /** Gap between children (cells). Works with both `row` and `column` directions. */
  gap?: number;

  // ── Flex ─────────────────────────────────────────────────────
  /** Direction of the main axis. Default `"column"`. */
  flexDirection?: "row" | "column";
  /** Whether children wrap to the next line. */
  flexWrap?: "nowrap" | "wrap";
  /** Alignment along the main axis. */
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around";
  /** Alignment along the cross axis. */
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  /** How much this element grows to fill available space (default `0`). */
  flexGrow?: number;
  /** How much this element shrinks when space is tight (default `1`). */
  flexShrink?: number;

  // ── Positioning / overlays ───────────────────────────────────
  /** Positioning mode. `"absolute"` elements are taken out of flow. */
  position?: "relative" | "absolute";
  /** Top offset for absolute positioning. */
  top?: DimensionValue;
  /** Right offset for absolute positioning. */
  right?: DimensionValue;
  /** Bottom offset for absolute positioning. */
  bottom?: DimensionValue;
  /** Left offset for absolute positioning. */
  left?: DimensionValue;
  /** Shorthand for top/right/bottom/left simultaneously. */
  inset?: DimensionValue;
  /** Stack order for overlapping elements. Higher = on top. */
  zIndex?: number;
  /** Controls whether this element blocks mouse/focus events. */
  pointerEvents?: "auto" | "none";

  // ── Paint ────────────────────────────────────────────────────
  /** Background color. */
  bg?: Color;
  /** Border drawing style. */
  border?: BorderStyle;
  /** Border color (requires `border` to be set). */
  borderColor?: Color;
  /** Clip overflowing children (used internally by ScrollView). */
  clip?: boolean;

  // ── Text ─────────────────────────────────────────────────────
  /** Text (foreground) color. Inherited by children. */
  color?: Color;
  /** Render text in bold. */
  bold?: boolean;
  /** Render text in dim/faint. */
  dim?: boolean;
  /** Render text in italic. */
  italic?: boolean;
  /** Render text with underline. */
  underline?: boolean;
  /** Text wrapping mode. */
  wrap?: WrapMode;
  /** Horizontal text alignment within the container. */
  textAlign?: TextAlign;
}

/**
 * Computed layout rectangle for a node (returned by {@link useLayout}).
 *
 * `x`, `y`, `width`, `height` are the **outer** bounds (including border).
 * `innerX`, `innerY`, `innerWidth`, `innerHeight` are the **content** bounds
 * (after border and padding).
 */
export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  innerX: number;
  innerY: number;
  innerWidth: number;
  innerHeight: number;
}

/**
 * Parsed key press information.
 *
 * Received by {@link useInput} handlers, `onKeyPress` callbacks,
 * and {@link Keybind} matching.
 */
export interface Key {
  /** Key name (`"a"`, `"return"`, `"escape"`, `"up"`, `"space"`, …). */
  name: string;
  /** Raw byte sequence from the terminal. */
  sequence: string;
  /** `true` when Ctrl is held. */
  ctrl?: boolean;
  /** `true` when Alt / Option is held. */
  alt?: boolean;
  /** `true` when Shift is held. */
  shift?: boolean;
  /** `true` when Meta / Cmd / Super / Win is held. */
  meta?: boolean;
}

/**
 * Options for the top-level {@link render} function.
 */
export interface RenderOptions {
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  debug?: boolean;
  /** Use the terminal's native cursor instead of a simulated one. Enables cursor shaders/animations in supported terminals. Default: true */
  useNativeCursor?: boolean;
}

/**
 * Handle returned by {@link render}, used to control the application lifecycle.
 */
export interface AppHandle {
  /** Tear down the React tree and clean up terminal state. */
  unmount(): void;
  /** Exit the process with an optional exit code. */
  exit(code?: number): void;
}
