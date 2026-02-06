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

export type HexColor = `#${string}`;

export type RGBColor = { r: number; g: number; b: number };

export type Color = NamedColor | HexColor | RGBColor | number;

export type DimensionValue = number | `${number}%`;

export type BorderStyle = "none" | "single" | "double" | "round" | "ascii";

export type WrapMode = "wrap" | "truncate" | "ellipsis" | "none";

export type TextAlign = "left" | "center" | "right";

export interface Style {
  // Layout
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;

  // Flex
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  flexGrow?: number;
  flexShrink?: number;

  // Positioning / overlays
  position?: "relative" | "absolute";
  top?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  inset?: DimensionValue;
  zIndex?: number;
  pointerEvents?: "auto" | "none";

  // Paint
  bg?: Color;
  border?: BorderStyle;
  borderColor?: Color;
  clip?: boolean;

  // Text
  color?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  wrap?: WrapMode;
  textAlign?: TextAlign;
}

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

export interface Key {
  name: string;
  sequence: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface RenderOptions {
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  debug?: boolean;
  /** Use the terminal's native cursor instead of a simulated one. Enables cursor shaders/animations in supported terminals. Default: true */
  useNativeCursor?: boolean;
}

export interface AppHandle {
  unmount(): void;
  exit(code?: number): void;
}
