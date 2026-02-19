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
 * @category Components
 */
export type TableVariant = "full" | "clean" | "clean-vertical";

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

/** Recursively sum the text length of React children (single-line approximation). */
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
      const textLen = extractTextLength(cell.props.children);
      const total = textLen + padL + padR;
      maxWidths[i] = Math.max(maxWidths[i] ?? 0, total);
    }
  }
  return maxWidths;
}

// ── Internal helpers ─────────────────────────────────────────────

/** Enough `─` repetitions to fill any column; truncated by wrap:"truncate". */
const HORIZ_FILL = 300;

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
 * // Clean variant — header separator only
 * <Table variant="clean" borderColor="gray">
 *   <TableRow>
 *     <TableCell style={{ bold: true }}>Name</TableCell>
 *     <TableCell style={{ bold: true }}>Score</TableCell>
 *   </TableRow>
 *   <TableRow>
 *     <TableCell>Alice</TableCell>
 *     <TableCell>98</TableCell>
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
    contentItems.push(
      React.createElement("text" as any, { key: "vl", style: colorStyle }, chars.vertical),
    );
  }

  for (let i = 0; i < cells.length; i++) {
    // Vertical separator │ between cells
    if (i > 0 && showInnerVertical) {
      contentItems.push(
        React.createElement("text" as any, { key: `vs${i}`, style: colorStyle }, chars.vertical),
      );
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
    contentItems.push(
      React.createElement("text" as any, { key: "vr", style: colorStyle }, chars.vertical),
    );
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
