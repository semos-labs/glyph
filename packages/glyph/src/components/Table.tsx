import React, { createContext, useContext } from "react";
import type { ReactNode, ReactElement } from "react";
import type { Style, Color, BorderStyle } from "../types/index.js";

// ── Table border character sets ──────────────────────────────────

/** @internal Box-drawing characters for table grid lines. */
interface TableBorderChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
  teeDown: string;
  teeUp: string;
  teeRight: string;
  teeLeft: string;
  cross: string;
}

const TABLE_BORDERS: Record<Exclude<BorderStyle, "none">, TableBorderChars> = {
  single: {
    topLeft: "┌", topRight: "┐", bottomLeft: "└", bottomRight: "┘",
    horizontal: "─", vertical: "│",
    teeDown: "┬", teeUp: "┴", teeRight: "├", teeLeft: "┤", cross: "┼",
  },
  double: {
    topLeft: "╔", topRight: "╗", bottomLeft: "╚", bottomRight: "╝",
    horizontal: "═", vertical: "║",
    teeDown: "╦", teeUp: "╩", teeRight: "╠", teeLeft: "╣", cross: "╬",
  },
  round: {
    topLeft: "╭", topRight: "╮", bottomLeft: "╰", bottomRight: "╯",
    horizontal: "─", vertical: "│",
    teeDown: "┬", teeUp: "┴", teeRight: "├", teeLeft: "┤", cross: "┼",
  },
  ascii: {
    topLeft: "+", topRight: "+", bottomLeft: "+", bottomRight: "+",
    horizontal: "-", vertical: "|",
    teeDown: "+", teeUp: "+", teeRight: "+", teeLeft: "+", cross: "+",
  },
};

// ── Variant type ─────────────────────────────────────────────────

/**
 * Controls which grid lines are drawn.
 *
 * | Variant | Surrounding border | Header separator | Row separators | Column separators |
 * |---|---|---|---|---|
 * | `"full"` | ✓ | ✓ | ✓ | ✓ |
 * | `"clean"` | ✗ | ✓ | ✗ | ✗ |
 * | `"clean-vertical"` | ✗ | ✓ | ✗ | ✓ |
 *
 * @category Tables
 */
export type TableVariant = "full" | "clean" | "clean-vertical";

/**
 * Horizontal alignment for cell content.
 * @category Tables
 */
export type CellAlign = "left" | "center" | "right";

/**
 * Vertical alignment for cell content.
 * @category Tables
 */
export type CellVerticalAlign = "top" | "center" | "bottom";

// ── Context ──────────────────────────────────────────────────────

interface TableContextValue {
  chars: TableBorderChars;
  borderColor?: Color;
  /** Per-column content widths (including padding). `null` when `wrap` is off. */
  columnWidths: number[] | null;
  /** Layout variant controlling which grid lines are drawn. */
  variant: TableVariant;
}

const TableContext = createContext<TableContextValue | null>(null);

// ── Content measurement ─────────────────────────────────────────

/**
 * Recursively sum the text length of React children (single-line approximation).
 * For non-text elements (components like Progress, Spinner, etc.) this returns 0
 * — use the `minWidth` prop on {@link TableCell} to hint at the expected width.
 */
function extractTextLength(node: ReactNode): number {
  if (node == null || typeof node === "boolean") return 0;
  if (typeof node === "string") return node.length;
  if (typeof node === "number") return String(node).length;
  if (Array.isArray(node))
    return node.reduce((sum: number, c) => sum + extractTextLength(c), 0);
  if (React.isValidElement(node))
    return extractTextLength((node as ReactElement<any>).props.children);
  return 0;
}

/**
 * Scan every row to find the maximum content width of each column.
 * Width includes the cell's horizontal padding (defaults to `1` per side).
 *
 * When a cell specifies `minWidth`, that value takes priority over the
 * auto-measured text length. This is essential for cells containing rich
 * content (e.g. `Progress`, `Spinner`, `Image`) whose width cannot be
 * determined from text alone.
 */
function measureColumnWidths(rows: ReactElement[]): number[] {
  const maxWidths: number[] = [];
  for (const row of rows) {
    const cells = React.Children.toArray(
      (row.props as TableRowProps).children,
    ).filter(React.isValidElement);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as ReactElement<TableCellProps>;
      const s = cell.props.style;
      const padL =
        typeof s?.paddingLeft === "number" ? s.paddingLeft
        : typeof s?.paddingX === "number" ? s.paddingX
        : 1;
      const padR =
        typeof s?.paddingRight === "number" ? s.paddingRight
        : typeof s?.paddingX === "number" ? s.paddingX
        : 1;
      // If the cell declares a minWidth, use it as the content width hint
      const cellMinWidth = cell.props.minWidth;
      const textLen = extractTextLength(cell.props.children);
      const contentWidth = typeof cellMinWidth === "number"
        ? Math.max(cellMinWidth, textLen)
        : textLen;
      const total = contentWidth + padL + padR;
      maxWidths[i] = Math.max(maxWidths[i] ?? 0, total);
    }
  }
  return maxWidths;
}

// ── Internal helpers ─────────────────────────────────────────────

/** Enough `─` repetitions to fill any column; truncated by wrap:"truncate". */
const HORIZ_FILL = 300;

/** Enough `│` repetitions to fill any row height; clipped by the box bounds. */
const VERT_FILL = 300;

/**
 * Creates a vertical border element that stretches the full height of its
 * row.  The outer `box` has no in-flow content so Yoga sizes it at 0
 * intrinsic height; `alignItems:"stretch"` (the default) makes it match
 * the row.  The absolute-positioned `text` then fills the box with the
 * border character, one per line.
 */
function verticalBorder(
  key: string,
  char: string,
  colorStyle: Style | undefined,
): ReactNode {
  return React.createElement(
    "box" as any,
    { key, style: { width: 1 } },
    React.createElement("text" as any, {
      style: {
        ...colorStyle,
        position: "absolute" as const,
        inset: 0,
      },
    }, char.repeat(VERT_FILL)),
  );
}

type SepPosition = "top" | "middle" | "bottom";

/**
 * Renders a horizontal grid line.
 *
 * In `"full"` mode: `┌──┬──┐` / `├──┼──┤` / `└──┴──┘`
 * In `"clean"` mode: `──────────` (no corners or junctions)
 * In `"clean-vertical"` mode: `──────┼──────` (junctions but no corners)
 */
function HorizontalRule({
  position,
  colCount,
  chars,
  borderColor,
  columnWidths,
  variant = "full",
}: {
  position: SepPosition;
  colCount: number;
  chars: TableBorderChars;
  borderColor?: Color;
  columnWidths: number[] | null;
  variant?: TableVariant;
}): ReactElement {
  const cs: Style | undefined = borderColor ? { color: borderColor } : undefined;
  const fillStyle: Style = { wrap: "truncate" as const, ...cs };

  const items: ReactNode[] = [];

  // Left corner (full variant only)
  if (variant === "full") {
    const left =
      position === "top" ? chars.topLeft
      : position === "bottom" ? chars.bottomLeft
      : chars.teeRight;
    items.push(
      React.createElement("text" as any, { key: "l", style: cs }, left),
    );
  }

  for (let i = 0; i < colCount; i++) {
    // Junction between columns
    if (i > 0) {
      if (variant === "full") {
        const junction =
          position === "top" ? chars.teeDown
          : position === "bottom" ? chars.teeUp
          : chars.cross;
        items.push(
          React.createElement("text" as any, { key: `j${i}`, style: cs }, junction),
        );
      } else if (variant === "clean-vertical") {
        items.push(
          React.createElement("text" as any, { key: `j${i}`, style: cs }, chars.cross),
        );
      }
      // "clean" variant: no junction — fills are adjacent for a continuous line
    }

    // Horizontal fill ─────
    const fillBoxStyle: Style = columnWidths
      ? { width: columnWidths[i] }
      : { flexGrow: 1, flexBasis: 0 };
    items.push(
      React.createElement(
        "box" as any,
        { key: `f${i}`, style: fillBoxStyle },
        React.createElement(
          "text" as any,
          { style: fillStyle },
          chars.horizontal.repeat(HORIZ_FILL),
        ),
      ),
    );
  }

  // Right corner (full variant only)
  if (variant === "full") {
    const right =
      position === "top" ? chars.topRight
      : position === "bottom" ? chars.bottomRight
      : chars.teeLeft;
    items.push(
      React.createElement("text" as any, { key: "r", style: cs }, right),
    );
  }

  return React.createElement(
    "box" as any,
    { style: { flexDirection: "row" as const, flexShrink: 0 } },
    ...items,
  );
}

// ── Table ────────────────────────────────────────────────────────

/**
 * Props for the {@link Table} component.
 */
export interface TableProps {
  /** Border drawing style. Default `"single"`. */
  border?: BorderStyle;
  /** Border / grid-line color. */
  borderColor?: Color;
  /**
   * Layout variant controlling which grid lines are drawn.
   *
   * - `"full"` — all borders: surrounding border, row separators, and
   *   column separators (default).
   * - `"clean"` — only a horizontal rule separating the header (first
   *   row) from the rest. No surrounding border, no column borders.
   * - `"clean-vertical"` — same as `"clean"` plus vertical borders
   *   between columns. No surrounding border, no horizontal borders
   *   between data rows.
   *
   * @default "full"
   */
  variant?: TableVariant;
  /**
   * When `true`, each column shrinks to the width of its widest cell
   * content instead of distributing space equally.
   *
   * @default false
   */
  wrap?: boolean;
  /** Additional style for the outer table container. */
  style?: Style;
  /** {@link TableRow} children. */
  children?: ReactNode;
}

/**
 * Bordered table built entirely with flexbox.
 *
 * Renders seamless box-drawing borders around and between every row
 * and cell. Compose with {@link TableRow} (or {@link TableHeaderRow})
 * and {@link TableCell}.
 *
 * Cells support **rich content** — any React element works as cell
 * children, including `<Progress>`, `<Spinner>`, `<Link>`, `<Box>`
 * layouts, and `<Text>` with inline styling. Multi-line cells are
 * fully supported; vertical borders stretch automatically.
 *
 * @example
 * Basic text table
 * ```tsx
 * <Table border="single" borderColor="cyan">
 *   <TableRow>
 *     <TableCell>Name</TableCell>
 *     <TableCell>Age</TableCell>
 *   </TableRow>
 *   <TableRow>
 *     <TableCell>Alice</TableCell>
 *     <TableCell>30</TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Clean variant with header row
 * ```tsx
 * <Table variant="clean" borderColor="gray">
 *   <TableHeaderRow>
 *     <TableCell>Name</TableCell>
 *     <TableCell>Score</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>Alice</TableCell>
 *     <TableCell>98</TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Status indicators — colored icons with text
 * ```tsx
 * <Table border="round" borderColor="cyan">
 *   <TableHeaderRow>
 *     <TableCell>Service</TableCell>
 *     <TableCell>Status</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>API</TableCell>
 *     <TableCell>
 *       <Box style={{ flexDirection: "row", gap: 1 }}>
 *         <Text style={{ color: "green" }}>●</Text>
 *         <Text>Healthy</Text>
 *       </Box>
 *     </TableCell>
 *   </TableRow>
 *   <TableRow>
 *     <TableCell>Database</TableCell>
 *     <TableCell>
 *       <Box style={{ flexDirection: "row", gap: 1 }}>
 *         <Text style={{ color: "red" }}>●</Text>
 *         <Text>Down</Text>
 *       </Box>
 *     </TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Progress bars in cells — wrap in a flex box so width resolves correctly
 * ```tsx
 * <Table borderColor="blue">
 *   <TableHeaderRow>
 *     <TableCell>Task</TableCell>
 *     <TableCell>Progress</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>Build</TableCell>
 *     <TableCell>
 *       <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
 *         <Progress value={0.75} showPercent />
 *       </Box>
 *     </TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Multi-line cells — stacked content with vertical borders
 * ```tsx
 * <Table border="double" borderColor="green">
 *   <TableHeaderRow>
 *     <TableCell>Project</TableCell>
 *     <TableCell>Details</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>
 *       <Box style={{ flexDirection: "column" }}>
 *         <Text style={{ bold: true }}>glyph-core</Text>
 *         <Text style={{ dim: true }}>v2.4.1</Text>
 *       </Box>
 *     </TableCell>
 *     <TableCell>
 *       <Box style={{ flexDirection: "column" }}>
 *         <Box style={{ flexDirection: "row", gap: 1 }}>
 *           <Text style={{ color: "green" }}>+142</Text>
 *           <Text style={{ color: "red" }}>-38</Text>
 *         </Box>
 *         <Text style={{ dim: true }}>Last commit: 2h ago</Text>
 *       </Box>
 *     </TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Spinners and links
 * ```tsx
 * <Table variant="clean-vertical" borderColor="magenta">
 *   <TableHeaderRow>
 *     <TableCell>Service</TableCell>
 *     <TableCell>Activity</TableCell>
 *     <TableCell>Docs</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>Auth</TableCell>
 *     <TableCell>
 *       <Spinner label="Processing" style={{ color: "green" }} />
 *     </TableCell>
 *     <TableCell>
 *       <Link href="https://docs.example.com/auth">
 *         <Text style={{ color: "blueBright", underline: true }}>
 *           docs.example.com
 *         </Text>
 *       </Link>
 *     </TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Cell alignment
 * ```tsx
 * <Table borderColor="yellow">
 *   <TableHeaderRow>
 *     <TableCell>Left (default)</TableCell>
 *     <TableCell align="center">Centered</TableCell>
 *     <TableCell align="right">Right-aligned</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>Alice</TableCell>
 *     <TableCell align="center">98</TableCell>
 *     <TableCell align="right">
 *       <Text style={{ color: "green" }}>✓ Pass</Text>
 *     </TableCell>
 *   </TableRow>
 * </Table>
 * ```
 * @category Tables
 */
export function Table({
  children,
  style,
  border = "single",
  borderColor,
  variant = "full",
  wrap = false,
}: TableProps): ReactElement {
  const bs: Exclude<BorderStyle, "none"> = border === "none" ? "single" : border;
  const chars = TABLE_BORDERS[bs];

  const rows = React.Children.toArray(children).filter(
    React.isValidElement,
  ) as ReactElement[];

  const columnWidths = wrap ? measureColumnWidths(rows) : null;
  const ctx: TableContextValue = { chars, borderColor, columnWidths, variant };

  const content: ReactNode[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as ReactElement<any>;
    content.push(
      React.cloneElement(row, {
        key: row.key ?? `row-${i}`,
        _tableFirst: i === 0,
        _tableLast: i === rows.length - 1,
      }),
    );
  }

  return React.createElement(
    TableContext.Provider,
    { value: ctx },
    React.createElement(
      "box" as any,
      { style: { flexDirection: "column" as const, ...style } },
      ...content,
    ),
  );
}

// ── TableRow ─────────────────────────────────────────────────────

/**
 * Props for the {@link TableRow} component.
 */
export interface TableRowProps {
  /** Style applied to the content row (the row containing the cells). */
  style?: Style;
  /** {@link TableCell} children. */
  children?: ReactNode;
}

/**
 * A single row inside a {@link Table}.
 *
 * Must be a direct child of `<Table>`. Contains one or more
 * {@link TableCell} elements. Cells can hold any React content — when
 * one cell is taller than others (e.g. multi-line content), vertical
 * borders stretch to match.
 *
 * @example
 * Plain text row
 * ```tsx
 * <TableRow>
 *   <TableCell>Alice</TableCell>
 *   <TableCell>30</TableCell>
 * </TableRow>
 * ```
 *
 * @example
 * Rich content row — status badge, progress bar, link
 * ```tsx
 * <TableRow>
 *   <TableCell style={{ bold: true }}>API Gateway</TableCell>
 *   <TableCell>
 *     <Box style={{ flexDirection: "row", gap: 1 }}>
 *       <Text style={{ color: "green" }}>●</Text>
 *       <Text>Healthy</Text>
 *     </Box>
 *   </TableCell>
 *   <TableCell>
 *     <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
 *       <Progress value={0.42} />
 *     </Box>
 *   </TableCell>
 *   <TableCell>
 *     <Link href="https://api.example.com" focusable={false}>
 *       <Text style={{ color: "blueBright", underline: true }}>
 *         api.example.com
 *       </Text>
 *     </Link>
 *   </TableCell>
 * </TableRow>
 * ```
 *
 * @example
 * Multi-line row — stacked content in cells
 * ```tsx
 * <TableRow>
 *   <TableCell>
 *     <Box style={{ flexDirection: "column" }}>
 *       <Text style={{ bold: true }}>glyph-core</Text>
 *       <Text style={{ dim: true, italic: true }}>v2.4.1</Text>
 *     </Box>
 *   </TableCell>
 *   <TableCell>
 *     <Box style={{ flexDirection: "column" }}>
 *       <Text>142 changes</Text>
 *       <Text style={{ dim: true }}>Last commit: 2h ago</Text>
 *     </Box>
 *   </TableCell>
 * </TableRow>
 * ```
 * @category Tables
 */
export function TableRow(props: TableRowProps): ReactElement {
  const { children, style } = props;
  const isFirst: boolean = (props as any)._tableFirst ?? false;
  const isLast: boolean = (props as any)._tableLast ?? false;

  const ctx = useContext(TableContext);
  if (!ctx) {
    throw new Error("TableRow must be rendered inside a <Table>.");
  }

  const { chars, borderColor, variant } = ctx;
  const cells = React.Children.toArray(children).filter(React.isValidElement);
  const colCount = cells.length;

  const colorStyle: Style | undefined = borderColor ? { color: borderColor } : undefined;
  const isClean = variant === "clean" || variant === "clean-vertical";
  const showInnerVertical = variant === "full" || variant === "clean-vertical";
  const showOuterVertical = variant === "full";

  // ── Build content row ──
  const contentItems: ReactNode[] = [];

  // Left border │ (full only)
  if (showOuterVertical) {
    contentItems.push(verticalBorder("vl", chars.vertical, colorStyle));
  }

  for (let i = 0; i < cells.length; i++) {
    // Vertical separator │ between cells
    if (i > 0 && showInnerVertical) {
      contentItems.push(verticalBorder(`vs${i}`, chars.vertical, colorStyle));
    }
    // Cell wrapper
    const cellBoxStyle: Style = ctx.columnWidths
      ? { width: ctx.columnWidths[i] }
      : { flexGrow: 1, flexBasis: 0 };
    contentItems.push(
      React.createElement(
        "box" as any,
        { key: `c${i}`, style: cellBoxStyle },
        cells[i],
      ),
    );
  }

  // Right border │ (full only)
  if (showOuterVertical) {
    contentItems.push(verticalBorder("vr", chars.vertical, colorStyle));
  }

  const contentRow = React.createElement(
    "box" as any,
    { key: "content", style: { flexDirection: "row" as const, ...style } },
    ...contentItems,
  );

  // ── Assemble row parts ──
  const parts: ReactNode[] = [];

  if (isClean) {
    // Clean variants: content first, then header separator after the
    // first row only (no surrounding border, no row separators).
    parts.push(contentRow);
    if (isFirst && !isLast) {
      parts.push(
        React.createElement(HorizontalRule, {
          key: "header-sep",
          position: "middle",
          colCount,
          chars,
          borderColor,
          columnWidths: ctx.columnWidths,
          variant,
        }),
      );
    }
  } else {
    // Full variant: top HR + content + (bottom HR if last)
    parts.push(
      React.createElement(HorizontalRule, {
        key: "top",
        position: isFirst ? "top" : "middle",
        colCount,
        chars,
        borderColor,
        columnWidths: ctx.columnWidths,
        variant,
      }),
    );
    parts.push(contentRow);
    if (isLast) {
      parts.push(
        React.createElement(HorizontalRule, {
          key: "bottom",
          position: "bottom",
          colCount,
          chars,
          borderColor,
          columnWidths: ctx.columnWidths,
          variant,
        }),
      );
    }
  }

  return React.createElement(React.Fragment, null, ...parts);
}

// ── TableCell ────────────────────────────────────────────────────

/**
 * Props for the {@link TableCell} component.
 */
export interface TableCellProps {
  /** Style for the cell container. Horizontal padding defaults to `1`. */
  style?: Style;
  /**
   * Cell content — can be plain text, numbers, or **any React element**.
   *
   * Strings and numbers are automatically wrapped in a `Text` element.
   * Rich content (e.g. `<Progress>`, `<Spinner>`, `<Box>` layouts,
   * `<Link>`, `<Text>` with inline styling) is passed through as-is.
   *
   * For `<Progress>` bars, wrap them in a flex box so `width: "100%"`
   * resolves relative to the wrapper instead of overflowing the cell:
   *
   * ```tsx
   * <TableCell>
   *   <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
   *     <Progress value={0.7} showPercent />
   *   </Box>
   * </TableCell>
   * ```
   *
   * For multi-line cells, use a vertical `<Box>` layout:
   *
   * ```tsx
   * <TableCell>
   *   <Box style={{ flexDirection: "column" }}>
   *     <Text style={{ bold: true }}>Title</Text>
   *     <Text style={{ dim: true }}>Subtitle</Text>
   *   </Box>
   * </TableCell>
   * ```
   */
  children?: ReactNode;
  /**
   * Horizontal alignment of cell content.
   *
   * - `"left"` — align to the start (default)
   * - `"center"` — center content
   * - `"right"` — align to the end
   *
   * @default "left"
   */
  align?: CellAlign;
  /**
   * Vertical alignment of cell content (useful for multi-line rows).
   *
   * - `"top"` — align to the top (default)
   * - `"center"` — center vertically
   * - `"bottom"` — align to the bottom
   *
   * @default "top"
   */
  verticalAlign?: CellVerticalAlign;
  /**
   * Minimum content width hint (in columns) for `wrap` mode measurement.
   *
   * When a cell contains non-text content (e.g. `<Progress>`, `<Spinner>`,
   * or complex layouts), the automatic text-length measurement returns `0`.
   * Set `minWidth` to tell the table how wide the content should be so
   * column sizing works correctly in `wrap` mode.
   *
   * Has no effect when the table's `wrap` prop is `false` (the default).
   *
   * @example
   * ```tsx
   * <TableCell minWidth={20}>
   *   <Progress value={0.5} />
   * </TableCell>
   * ```
   */
  minWidth?: number;
}

/** @internal Map {@link CellAlign} to flexbox `justifyContent`. */
const ALIGN_MAP: Record<CellAlign, Style["justifyContent"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

/** @internal Map {@link CellVerticalAlign} to flexbox `alignItems`. */
const VALIGN_MAP: Record<CellVerticalAlign, Style["alignItems"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

/**
 * A single cell inside a {@link TableRow}.
 *
 * Accepts **any React content** as children — plain strings, numbers, or
 * rich elements like `<Progress>`, `<Spinner>`, `<Link>`, `<Box>`
 * layouts, nested `<Text>` with inline styles, and more.
 *
 * Strings and numbers are automatically wrapped in a `Text` element.
 * Horizontal padding defaults to `1` character on each side (overridable
 * via `style`).
 *
 * @example
 * Simple text
 * ```tsx
 * <TableCell>Hello</TableCell>
 * <TableCell style={{ bold: true, color: "cyan" }}>World</TableCell>
 * ```
 *
 * @example
 * Status indicator with colored icon
 * ```tsx
 * <TableCell>
 *   <Box style={{ flexDirection: "row", gap: 1 }}>
 *     <Text style={{ color: "green" }}>●</Text>
 *     <Text>Healthy</Text>
 *   </Box>
 * </TableCell>
 * ```
 *
 * @example
 * Progress bar — wrap in a flex box so width resolves correctly
 * ```tsx
 * <TableCell>
 *   <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
 *     <Progress value={0.65} showPercent />
 *   </Box>
 * </TableCell>
 * ```
 *
 * @example
 * Spinner with label
 * ```tsx
 * <TableCell>
 *   <Spinner label="Syncing..." style={{ color: "cyan" }} />
 * </TableCell>
 * ```
 *
 * @example
 * Clickable link
 * ```tsx
 * <TableCell>
 *   <Link href="https://docs.example.com" focusable={false}>
 *     <Text style={{ color: "blueBright", underline: true }}>
 *       View docs
 *     </Text>
 *   </Link>
 * </TableCell>
 * ```
 *
 * @example
 * Multi-line stacked content
 * ```tsx
 * <TableCell>
 *   <Box style={{ flexDirection: "column" }}>
 *     <Text style={{ bold: true }}>glyph-core</Text>
 *     <Text style={{ dim: true, italic: true }}>v2.4.1</Text>
 *   </Box>
 * </TableCell>
 * ```
 *
 * @example
 * Alignment — centered spinner with vertical centering for tall rows
 * ```tsx
 * <TableCell align="center" verticalAlign="center">
 *   <Spinner label="Loading..." style={{ color: "yellow" }} />
 * </TableCell>
 * ```
 *
 * @example
 * Right-aligned numeric value
 * ```tsx
 * <TableCell align="right">
 *   <Text style={{ color: "green", bold: true }}>$1,234.56</Text>
 * </TableCell>
 * ```
 * @category Tables
 */
export function TableCell({
  children,
  style,
  align,
  verticalAlign,
  minWidth: _minWidth,
}: TableCellProps): ReactElement {
  const alignStyle: Style = {};
  if (align) alignStyle.justifyContent = ALIGN_MAP[align];
  if (verticalAlign) alignStyle.alignItems = VALIGN_MAP[verticalAlign];

  const merged: Style = {
    paddingX: 1,
    flexDirection: "row" as const,
    flexGrow: 1,
    flexShrink: 1,
    ...alignStyle,
    ...style,
  };

  const content =
    typeof children === "string" || typeof children === "number"
      ? React.createElement("text" as any, null, String(children))
      : children;

  return React.createElement("box" as any, { style: merged }, content);
}

// ── TableHeaderRow ───────────────────────────────────────────────

/**
 * Props for the {@link TableHeaderRow} component.
 */
export interface TableHeaderRowProps {
  /** Style applied to the header row. Bold text is applied by default. */
  style?: Style;
  /** {@link TableCell} children representing column headers. */
  children?: ReactNode;
}

/**
 * Convenience component for table header rows.
 *
 * Behaves exactly like {@link TableRow} but applies bold text styling
 * by default, reducing boilerplate for the common pattern of bolding
 * every header cell.
 *
 * @example
 * Basic header
 * ```tsx
 * <Table borderColor="cyan">
 *   <TableHeaderRow>
 *     <TableCell>Name</TableCell>
 *     <TableCell>Status</TableCell>
 *     <TableCell>Score</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>Alice</TableCell>
 *     <TableCell>Active</TableCell>
 *     <TableCell>98</TableCell>
 *   </TableRow>
 * </Table>
 * ```
 *
 * @example
 * Colored header with alignment
 * ```tsx
 * <Table border="round" borderColor="magenta">
 *   <TableHeaderRow style={{ color: "magentaBright" }}>
 *     <TableCell>Service</TableCell>
 *     <TableCell align="center">Status</TableCell>
 *     <TableCell align="right">Load</TableCell>
 *   </TableHeaderRow>
 *   <TableRow>
 *     <TableCell>API Gateway</TableCell>
 *     <TableCell align="center">
 *       <Text style={{ color: "green" }}>● Healthy</Text>
 *     </TableCell>
 *     <TableCell align="right">42%</TableCell>
 *   </TableRow>
 * </Table>
 * ```
 * @category Tables
 */
export function TableHeaderRow(props: TableHeaderRowProps): ReactElement {
  const headerStyle: Style = { bold: true, ...props.style };
  return TableRow({ ...props, style: headerStyle });
}
