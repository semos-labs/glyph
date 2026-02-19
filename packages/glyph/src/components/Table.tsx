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

// ── Context ──────────────────────────────────────────────────────

interface TableContextValue {
  chars: TableBorderChars;
  borderColor?: Color;
}

const TableContext = createContext<TableContextValue | null>(null);

// ── Internal helpers ─────────────────────────────────────────────

/** Enough `─` repetitions to fill any column; truncated by wrap:"truncate". */
const HORIZ_FILL = 300;

type SepPosition = "top" | "middle" | "bottom";

/**
 * Renders a horizontal grid line: `┌──┬──┐` / `├──┼──┤` / `└──┴──┘`
 *
 * Each `─` fill segment uses `flexGrow: 1` so it automatically matches
 * the corresponding cell width in the content row.
 */
function HorizontalRule({
  position,
  colCount,
  chars,
  borderColor,
}: {
  position: SepPosition;
  colCount: number;
  chars: TableBorderChars;
  borderColor?: Color;
}): ReactElement {
  const left =
    position === "top" ? chars.topLeft
    : position === "bottom" ? chars.bottomLeft
    : chars.teeRight;
  const right =
    position === "top" ? chars.topRight
    : position === "bottom" ? chars.bottomRight
    : chars.teeLeft;
  const junction =
    position === "top" ? chars.teeDown
    : position === "bottom" ? chars.teeUp
    : chars.cross;

  const cs: Style | undefined = borderColor ? { color: borderColor } : undefined;
  const fillStyle: Style = { wrap: "truncate" as const, ...cs };

  const items: ReactNode[] = [];

  // Left corner
  items.push(
    React.createElement("text" as any, { key: "l", style: cs }, left),
  );

  for (let i = 0; i < colCount; i++) {
    // Junction between columns
    if (i > 0) {
      items.push(
        React.createElement("text" as any, { key: `j${i}`, style: cs }, junction),
      );
    }
    // Horizontal fill ─────
    // flexBasis:0 ensures the grow algorithm distributes space
    // identically to the cell-wrapper boxes in the content row.
    items.push(
      React.createElement(
        "box" as any,
        { key: `f${i}`, style: { flexGrow: 1, flexBasis: 0 } },
        React.createElement(
          "text" as any,
          { style: fillStyle },
          chars.horizontal.repeat(HORIZ_FILL),
        ),
      ),
    );
  }

  // Right corner
  items.push(
    React.createElement("text" as any, { key: "r", style: cs }, right),
  );

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
  /** Additional style for the outer table container. */
  style?: Style;
  /** {@link TableRow} children. */
  children?: ReactNode;
}

/**
 * Bordered table built entirely with flexbox.
 *
 * Renders seamless box-drawing borders around and between every row
 * and cell. Compose with {@link TableRow} and {@link TableCell}.
 *
 * @example
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
 * ```tsx
 * // Double-border style
 * <Table border="double">
 *   <TableRow>
 *     <TableCell>╔══╗</TableCell>
 *     <TableCell>Fancy</TableCell>
 *   </TableRow>
 * </Table>
 * ```
 * @category Components
 */
export function Table({
  children,
  style,
  border = "single",
  borderColor,
}: TableProps): ReactElement {
  const bs: Exclude<BorderStyle, "none"> = border === "none" ? "single" : border;
  const chars = TABLE_BORDERS[bs];
  const ctx: TableContextValue = { chars, borderColor };

  const rows = React.Children.toArray(children).filter(React.isValidElement);

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
 * {@link TableCell} elements.
 *
 * @example
 * ```tsx
 * <TableRow>
 *   <TableCell>Alice</TableCell>
 *   <TableCell>30</TableCell>
 * </TableRow>
 * ```
 * @category Components
 */
export function TableRow(props: TableRowProps): ReactElement {
  const { children, style } = props;
  const isFirst: boolean = (props as any)._tableFirst ?? false;
  const isLast: boolean = (props as any)._tableLast ?? false;

  const ctx = useContext(TableContext);
  if (!ctx) {
    throw new Error("TableRow must be rendered inside a <Table>.");
  }

  const { chars, borderColor } = ctx;
  const cells = React.Children.toArray(children).filter(React.isValidElement);
  const colCount = cells.length;

  const colorStyle: Style | undefined = borderColor ? { color: borderColor } : undefined;

  // ── Build content row with vertical separators ──
  // Uses bare text elements for │ — exactly mirroring the structure of
  // HorizontalRule (bare text for corners/junctions, flexGrow:1 boxes
  // for fills). This keeps column widths perfectly aligned.
  const contentItems: ReactNode[] = [];

  // Left border │
  contentItems.push(
    React.createElement("text" as any, { key: "vl", style: colorStyle }, chars.vertical),
  );

  for (let i = 0; i < cells.length; i++) {
    // Vertical separator │ between cells
    if (i > 0) {
      contentItems.push(
        React.createElement("text" as any, { key: `vs${i}`, style: colorStyle }, chars.vertical),
      );
    }
    // Cell wrapper — flexBasis:0 + flexGrow:1 gives every column an
    // equal share of the remaining space (matching the fill boxes).
    // Unlike width:0, flexBasis:0 lets Yoga measure children at the
    // resolved (post-grow) width, so text wraps at the real column
    // width instead of 0.
    contentItems.push(
      React.createElement(
        "box" as any,
        { key: `c${i}`, style: { flexGrow: 1, flexBasis: 0 } },
        cells[i],
      ),
    );
  }

  // Right border │
  contentItems.push(
    React.createElement("text" as any, { key: "vr", style: colorStyle }, chars.vertical),
  );

  const contentRow = React.createElement(
    "box" as any,
    { key: "content", style: { flexDirection: "row" as const, ...style } },
    ...contentItems,
  );

  // ── Assemble: top separator + content row + (bottom separator if last) ──
  const parts: ReactNode[] = [
    React.createElement(HorizontalRule, {
      key: "top",
      position: isFirst ? "top" : "middle",
      colCount,
      chars,
      borderColor,
    }),
    contentRow,
  ];

  if (isLast) {
    parts.push(
      React.createElement(HorizontalRule, {
        key: "bottom",
        position: "bottom",
        colCount,
        chars,
        borderColor,
      }),
    );
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
  /** Cell content. Strings and numbers are automatically wrapped in a `Text` element. */
  children?: ReactNode;
}

/**
 * A single cell inside a {@link TableRow}.
 *
 * Strings and numbers passed as children are automatically wrapped
 * in a `Text` element. Horizontal padding defaults to `1` character
 * on each side (overridable via `style`).
 *
 * @example
 * ```tsx
 * <TableCell>Hello</TableCell>
 * <TableCell style={{ bold: true, color: "cyan" }}>World</TableCell>
 * ```
 * @category Components
 */
export function TableCell({
  children,
  style,
}: TableCellProps): ReactElement {
  const merged: Style = { paddingX: 1, ...style };

  const content =
    typeof children === "string" || typeof children === "number"
      ? React.createElement("text" as any, null, String(children))
      : children;

  return React.createElement("box" as any, { style: merged }, content);
}
