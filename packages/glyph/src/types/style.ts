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
 * @category Types
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

// ── Responsive primitives ────────────────────────────────────────

/**
 * Named terminal breakpoint.
 *
 * Breakpoints are **mobile-first** (like Tailwind / Chakra) — the largest
 * matching breakpoint wins.
 *
 * | Name   | Columns | Typical use case            |
 * |--------|---------|-----------------------------|
 * | `base` | 0 +     | Always applies (default)    |
 * | `sm`   | 40 +    | Split pane / small terminal |
 * | `md`   | 80 +    | Standard 80-col terminal    |
 * | `lg`   | 120 +   | Wide terminal               |
 * | `xl`   | 160 +   | Ultra-wide                  |
 *
 * @example
 * ```tsx
 * <Box style={{ flexDirection: { base: "column", md: "row" } }} />
 * ```
 * @category Types
 */
export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";

/**
 * A style value that can change depending on terminal width.
 *
 * Accepts either a plain value (backward-compatible) **or** an object keyed
 * by {@link Breakpoint} names.
 *
 * @example
 * ```tsx
 * // Plain value — works exactly like before
 * padding: 1
 *
 * // Responsive — different values at different terminal widths
 * padding: { base: 0, sm: 1, lg: 2 }
 * ```
 * @category Types
 */
export type Responsive<T> = T | { [K in Breakpoint]?: T };

// ── Style ────────────────────────────────────────────────────────

/**
 * Unified style object for all Glyph elements.
 *
 * Combines CSS-like flexbox layout, positioning, paint (colors, borders),
 * and text formatting into a single flat object.
 *
 * Every property supports {@link Responsive | responsive values} — pass a
 * plain value for a static style or a breakpoint object to adapt to the
 * terminal width:
 *
 * ```tsx
 * <Box
 *   style={{
 *     flexDirection: { base: "column", md: "row" },
 *     padding: { base: 0, sm: 1, lg: 2 },
 *     gap: 1, // plain values still work
 *   }}
 * />
 * ```
 * @category Types
 */
export interface Style {
  // ── Layout ───────────────────────────────────────────────────
  /** Width in cells or percentage of parent. */
  width?: Responsive<DimensionValue>;
  /** Height in cells or percentage of parent. */
  height?: Responsive<DimensionValue>;
  /** Minimum width in cells. */
  minWidth?: Responsive<number>;
  /** Minimum height in cells. */
  minHeight?: Responsive<number>;
  /** Maximum width in cells. */
  maxWidth?: Responsive<number>;
  /** Maximum height in cells. */
  maxHeight?: Responsive<number>;
  /** Padding on all four sides (cells). */
  padding?: Responsive<number>;
  /** Horizontal padding (left + right). */
  paddingX?: Responsive<number>;
  /** Vertical padding (top + bottom). */
  paddingY?: Responsive<number>;
  /** Top padding. */
  paddingTop?: Responsive<number>;
  /** Right padding. */
  paddingRight?: Responsive<number>;
  /** Bottom padding. */
  paddingBottom?: Responsive<number>;
  /** Left padding. */
  paddingLeft?: Responsive<number>;
  /** Gap between children (cells). Works with both `row` and `column` directions. */
  gap?: Responsive<number>;

  // ── Flex ─────────────────────────────────────────────────────
  /** Direction of the main axis. Default `"column"`. */
  flexDirection?: Responsive<"row" | "column">;
  /** Whether children wrap to the next line. */
  flexWrap?: Responsive<"nowrap" | "wrap">;
  /** Alignment along the main axis. */
  justifyContent?: Responsive<
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
  >;
  /** Alignment along the cross axis. */
  alignItems?: Responsive<"flex-start" | "center" | "flex-end" | "stretch">;
  /** How much this element grows to fill available space (default `0`). */
  flexGrow?: Responsive<number>;
  /** How much this element shrinks when space is tight (default `1`). */
  flexShrink?: Responsive<number>;

  // ── Positioning / overlays ───────────────────────────────────
  /** Positioning mode. `"absolute"` elements are taken out of flow. */
  position?: Responsive<"relative" | "absolute">;
  /** Top offset for absolute positioning. */
  top?: Responsive<DimensionValue>;
  /** Right offset for absolute positioning. */
  right?: Responsive<DimensionValue>;
  /** Bottom offset for absolute positioning. */
  bottom?: Responsive<DimensionValue>;
  /** Left offset for absolute positioning. */
  left?: Responsive<DimensionValue>;
  /** Shorthand for top/right/bottom/left simultaneously. */
  inset?: Responsive<DimensionValue>;
  /** Stack order for overlapping elements. Higher = on top. */
  zIndex?: Responsive<number>;
  /** Controls whether this element blocks mouse/focus events. */
  pointerEvents?: Responsive<"auto" | "none">;

  // ── Paint ────────────────────────────────────────────────────
  /** Background color. */
  bg?: Responsive<Color>;
  /** Border drawing style. */
  border?: Responsive<BorderStyle>;
  /** Border color (requires `border` to be set). */
  borderColor?: Responsive<Color>;
  /** Clip overflowing children (used internally by ScrollView). */
  clip?: Responsive<boolean>;

  // ── Text ─────────────────────────────────────────────────────
  /** Text (foreground) color. Inherited by children. */
  color?: Responsive<Color>;
  /** Render text in bold. */
  bold?: Responsive<boolean>;
  /** Render text in dim/faint. */
  dim?: Responsive<boolean>;
  /** Render text in italic. */
  italic?: Responsive<boolean>;
  /** Render text with underline. */
  underline?: Responsive<boolean>;
  /** Text wrapping mode. */
  wrap?: Responsive<WrapMode>;
  /** Horizontal text alignment within the container. */
  textAlign?: Responsive<TextAlign>;
}

/**
 * Style with all {@link Responsive} values resolved to their concrete types.
 *
 * Produced by the responsive resolution pass and consumed by the internal
 * layout (Yoga) and paint systems. You normally don't need this type
 * directly — use {@link Style} instead.
 *
 * @category Types
 */
export type ResolvedStyle = {
  [K in keyof Style]: [NonNullable<Style[K]>] extends [Responsive<infer T>]
    ? T | undefined
    : Style[K]
};

/**
 * Computed layout rectangle for a node (returned by {@link useLayout}).
 *
 * `x`, `y`, `width`, `height` are the **outer** bounds (including border).
 * `innerX`, `innerY`, `innerWidth`, `innerHeight` are the **content** bounds
 * (after border and padding).
 * @category Types
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
 * @category Types
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

/**
 * Query object for {@link useMediaQuery}.
 *
 * All conditions are combined with AND — every specified constraint must be
 * satisfied for the query to match.
 *
 * @example
 * ```tsx
 * // Match when terminal is at least 80 columns wide
 * const isWide = useMediaQuery({ minColumns: 80 });
 *
 * // Match when terminal is between 40–120 columns and at least 20 rows tall
 * const isMedium = useMediaQuery({ minColumns: 40, maxColumns: 120, minRows: 20 });
 * ```
 * @category Types
 */
export interface MediaQueryInput {
  /** Minimum terminal width in columns (inclusive). */
  minColumns?: number;
  /** Maximum terminal width in columns (inclusive). */
  maxColumns?: number;
  /** Minimum terminal height in rows (inclusive). */
  minRows?: number;
  /** Maximum terminal height in rows (inclusive). */
  maxRows?: number;
}
