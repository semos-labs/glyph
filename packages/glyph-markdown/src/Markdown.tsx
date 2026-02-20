import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Text,
  Link,
  Image,
  Table as GlyphTable,
  TableRow,
  TableHeaderRow,
  TableCell,
} from "@semos-labs/glyph";
import type { Style } from "@semos-labs/glyph";
import type {
  Root,
  RootContent,
  PhrasingContent,
  Paragraph,
  Heading,
  Blockquote,
  List as MdastList,
  ListItem,
  Code,
  Table,
  Image as MdastImage,
} from "mdast";
import { parseMarkdown } from "./parse.js";
import type { Highlighter, CreateHighlighterOptions } from "./highlight.js";

const HEADING_STYLES: Record<number, Style> = {
  1: { color: "magentaBright", bold: true },
  2: { color: "cyanBright", bold: true },
  3: { color: "greenBright", bold: true },
  4: { color: "yellowBright", bold: true },
  5: { color: "yellow", bold: true },
  6: { color: "white", bold: true },
};

// ── Inline segment types ──

interface TextSeg {
  type: "text";
  value: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
}

interface LinkSeg {
  type: "link";
  value: string;
  href: string;
  bold?: boolean;
  italic?: boolean;
}

interface ImageSeg {
  type: "image";
  src: string;
  alt: string;
}

type Segment = TextSeg | LinkSeg | ImageSeg;

interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
}

// ── Inline helpers ──

function textContent(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value;
      if (n.type === "inlineCode") return n.value;
      if ("children" in n) return textContent((n as any).children);
      return "";
    })
    .join("");
}

function flattenInline(
  nodes: PhrasingContent[],
  style: InlineStyle = {},
): Segment[] {
  const out: Segment[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out.push({ type: "text", value: node.value.replace(/\n/g, " "), ...style });
        break;
      case "strong":
        out.push(...flattenInline(node.children, { ...style, bold: true }));
        break;
      case "emphasis":
        out.push(...flattenInline(node.children, { ...style, italic: true }));
        break;
      case "delete":
        out.push(
          ...flattenInline((node as any).children ?? [], {
            ...style,
            strikethrough: true,
          }),
        );
        break;
      case "inlineCode":
        out.push({ type: "text", value: node.value, ...style, code: true });
        break;
      case "link": {
        const label = textContent(node.children) || node.url;
        out.push({
          type: "link",
          value: label,
          href: node.url,
          bold: style.bold,
          italic: style.italic,
        });
        break;
      }
      case "image": {
        const img = node as MdastImage;
        out.push({
          type: "image",
          src: img.url,
          alt: img.alt ?? "",
        });
        break;
      }
      case "break":
        out.push({ type: "text", value: "\n" });
        break;
      default:
        break;
    }
  }
  return out;
}

function mergeSegments(segments: Segment[]): Segment[] {
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (
      seg.type === "text" &&
      last?.type === "text" &&
      seg.bold === last.bold &&
      seg.italic === last.italic &&
      seg.code === last.code &&
      seg.strikethrough === last.strikethrough
    ) {
      last.value += seg.value;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

// ── Inline rendering ──

function SegmentText({ seg }: { seg: TextSeg }) {
  const style: Style = {};
  if (seg.bold) style.bold = true;
  if (seg.italic) style.italic = true;
  if (seg.strikethrough) {
    style.strikethrough = true;
    style.dim = true;
  }
  if (seg.code) style.color = "yellowBright";

  let text = seg.value;
  if (seg.code) text = `\`${text}\``;

  return <Text style={style}>{text}</Text>;
}

function renderTextSegment(seg: TextSeg, key: number, baseColor?: string): React.ReactNode {
  if (baseColor && !seg.code) {
    const style: Style = {
      color: baseColor as any,
      bold: seg.bold ?? undefined,
      italic: seg.italic ?? undefined,
      strikethrough: seg.strikethrough ?? undefined,
      dim: seg.strikethrough ?? undefined,
    };
    return <Text key={key} style={style}>{seg.value}</Text>;
  }
  return <SegmentText key={key} seg={seg} />;
}

function TextGroup({
  segments,
  baseColor,
  prefix,
  baseBold,
}: {
  segments: TextSeg[];
  baseColor?: string;
  prefix?: string;
  baseBold?: boolean;
}) {
  const parentStyle: Style = {
    color: (baseColor as any) ?? undefined,
    bold: baseBold ?? undefined,
  };
  return (
    <Text style={parentStyle}>
      {prefix}
      {segments.map((seg, i) => renderTextSegment(seg, i, baseColor))}
    </Text>
  );
}

function InlineContent({
  nodes,
  prefix,
  baseColor,
  baseBold,
}: {
  nodes: PhrasingContent[];
  prefix?: string;
  baseColor?: string;
  baseBold?: boolean;
}) {
  const baseStyle: InlineStyle = baseBold ? { bold: true } : {};
  const segments = mergeSegments(flattenInline(nodes, baseStyle));

  const hasNonText = segments.some((s) => s.type !== "text");

  if (!hasNonText) {
    return (
      <TextGroup
        segments={segments as TextSeg[]}
        baseColor={baseColor}
        prefix={prefix}
        baseBold={baseBold}
      />
    );
  }

  // Split segments into groups at link/image boundaries so text flows
  // naturally within each group, only breaking for non-text components.
  type Chunk =
    | { type: "text"; segments: TextSeg[] }
    | { type: "link"; seg: LinkSeg }
    | { type: "image"; seg: ImageSeg };
  const chunks: Chunk[] = [];
  let textBuf: TextSeg[] = [];

  for (const seg of segments) {
    if (seg.type === "text") {
      textBuf.push(seg);
    } else {
      if (textBuf.length > 0) {
        chunks.push({ type: "text", segments: textBuf });
        textBuf = [];
      }
      if (seg.type === "link") chunks.push({ type: "link", seg });
      else if (seg.type === "image") chunks.push({ type: "image", seg });
    }
  }
  if (textBuf.length > 0) chunks.push({ type: "text", segments: textBuf });

  return (
    <Box style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {chunks.map((chunk, i) => {
        if (chunk.type === "text") {
          return (
            <TextGroup
              key={i}
              segments={chunk.segments}
              baseColor={baseColor}
              prefix={i === 0 ? prefix : undefined}
              baseBold={baseBold}
            />
          );
        }
        if (chunk.type === "link") {
          return (
            <Link
              key={i}
              href={chunk.seg.href}
              style={{ color: "cyan", underline: true }}
              focusedStyle={{ bg: "cyan", color: "black" }}
            >
              <Text
                style={{
                  bold: chunk.seg.bold ?? undefined,
                  italic: chunk.seg.italic ?? undefined,
                }}
              >
                {chunk.seg.value}
              </Text>
            </Link>
          );
        }
        return (
          <MdImage key={i} src={chunk.seg.src} alt={chunk.seg.alt} />
        );
      })}
    </Box>
  );
}

// ── Block-level rendering ──

interface BlockCtx {
  highlighter?: Highlighter;
}

function BlockNode({ node, ctx }: { node: RootContent; ctx: BlockCtx }) {
  switch (node.type) {
    case "paragraph":
      return <MdParagraph node={node} />;
    case "heading":
      return <MdHeading node={node} />;
    case "blockquote":
      return <MdBlockquote node={node} ctx={ctx} />;
    case "list":
      return <MdList node={node as MdastList} ctx={ctx} />;
    case "listItem":
      return <MdListItem node={node as ListItem} ctx={ctx} />;
    case "code":
      return <MdCodeBlock node={node} highlighter={ctx.highlighter} />;
    case "thematicBreak":
      return <Text style={{ dim: true }}>{"─".repeat(50)}</Text>;
    case "table":
      return <MdTable node={node as Table} />;
    case "html":
      return null;
    default:
      return null;
  }
}

function MdParagraph({ node }: { node: Paragraph }) {
  // Standalone image paragraph — render as block-level image
  if (
    node.children.length === 1 &&
    node.children[0]!.type === "image"
  ) {
    const img = node.children[0] as MdastImage;
    return <MdImage src={img.url} alt={img.alt ?? ""} />;
  }
  return <InlineContent nodes={node.children} />;
}

const HEADING_ICONS: Record<number, string> = {
  1: "❶ ",
  2: "❷ ",
  3: "❸ ",
  4: "❹ ",
  5: "❺ ",
  6: "❻ ",
};

function MdHeading({ node }: { node: Heading }) {
  const style = HEADING_STYLES[node.depth] ?? HEADING_STYLES[6]!;
  const prefix = HEADING_ICONS[node.depth] ?? "● ";

  return (
    <InlineContent
      nodes={node.children}
      prefix={prefix}
      baseColor={style.color as string}
      baseBold
    />
  );
}

function MdBlockquote({ node, ctx }: { node: Blockquote; ctx: BlockCtx }) {
  return (
    <Box style={{ flexDirection: "column", paddingLeft: 1 }}>
      {node.children.map((child, i) => (
        <Box key={i} style={{ flexDirection: "row" }}>
          <Text style={{ color: "blackBright" }}>│ </Text>
          <Box style={{ flexDirection: "column", flexShrink: 1 }}>
            <BlockNode node={child} ctx={ctx} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function MdList({ node, ctx }: { node: MdastList; ctx: BlockCtx }) {
  return (
    <Box style={{ flexDirection: "column", paddingLeft: 2 }}>
      {node.children.map((item, i) => {
        const isTask = item.checked != null;
        let bullet: string;
        if (isTask) {
          bullet = item.checked ? "☑ " : "☐ ";
        } else if (node.ordered) {
          bullet = `${(node.start ?? 1) + i}. `;
        } else {
          bullet = "• ";
        }

        const bulletColor = isTask
          ? item.checked
            ? "green"
            : "blackBright"
          : node.ordered
            ? "yellow"
            : "cyan";

        return (
          <Box key={i} style={{ flexDirection: "row" }}>
            <Text style={{ color: bulletColor as any }}>{bullet}</Text>
            <Box style={{ flexDirection: "column", flexShrink: 1 }}>
              {item.children.map((child, ci) => (
                <BlockNode key={ci} node={child} ctx={ctx} />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function MdListItem({ node, ctx }: { node: ListItem; ctx: BlockCtx }) {
  return (
    <Box style={{ flexDirection: "column" }}>
      {node.children.map((child, i) => (
        <BlockNode key={i} node={child} ctx={ctx} />
      ))}
    </Box>
  );
}

function MdCodeBlock({
  node,
  highlighter,
}: {
  node: Code;
  highlighter?: Highlighter;
}) {
  const lines = useMemo(() => {
    if (!highlighter || !node.lang) return null;
    return highlighter.highlight(node.value, node.lang);
  }, [node.value, node.lang, highlighter]);

  return (
    <Box style={{ flexDirection: "column" }}>
      {node.lang && (
        <Text style={{ color: "blackBright", italic: true }}>
          {" "}
          {node.lang}
        </Text>
      )}
      <Box
        style={{
          border: "round",
          borderColor: "blackBright",
          paddingX: 1,
          flexDirection: "column",
        }}
      >
        <Text wrap="none">
          {lines
            ? lines.map((line, li) => (
                <React.Fragment key={li}>
                  {li > 0 && "\n"}
                  {line.map((token, ti) => (
                    <Text
                      key={ti}
                      style={{
                        color: (token.color as any) ?? undefined,
                        bold: token.bold ?? undefined,
                        italic: token.italic ?? undefined,
                        underline: token.underline ?? undefined,
                      }}
                    >
                      {token.content}
                    </Text>
                  ))}
                </React.Fragment>
              ))
            : node.value}
        </Text>
      </Box>
    </Box>
  );
}

function MdImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      placeholder={alt || undefined}
      autoSize
      maxWidth={60}
      maxHeight={20}
      focusable
    />
  );
}

function MdTable({ node }: { node: Table }) {
  const rows = node.children;
  if (rows.length === 0) return null;

  const alignments = node.align ?? [];

  return (
    <GlyphTable borderColor="blackBright">
      {rows.map((row, ri) => {
        const isHeader = ri === 0 && rows.length > 1;
        const Row = isHeader ? TableHeaderRow : TableRow;

        return (
          <Row key={ri}>
            {row.children.map((cell, ci) => (
              <TableCell key={ci} align={(alignments[ci] as any) ?? undefined}>
                <InlineContent nodes={cell.children as PhrasingContent[]} />
              </TableCell>
            ))}
          </Row>
        );
      })}
    </GlyphTable>
  );
}

// ── Main component ──

function astHasCodeBlocks(ast: Root): boolean {
  for (const node of ast.children) {
    if (node.type === "code") return true;
  }
  return false;
}

export interface MarkdownProps {
  /** Markdown source string. */
  children: string;
  /** Style applied to the outer container. */
  style?: Style;
  /**
   * Control syntax highlighting for code blocks.
   * - `undefined` (default): auto-loads Shiki lazily when code blocks are present
   * - `Highlighter` instance: use a pre-created highlighter
   * - `false`: disable syntax highlighting entirely
   * - `CreateHighlighterOptions`: auto-load with custom options
   */
  highlight?: Highlighter | false | CreateHighlighterOptions;
}

/**
 * Renders a markdown string as Glyph terminal UI components.
 *
 * Supports headings, paragraphs, lists, code blocks with syntax highlighting,
 * blockquotes, tables (GFM), links, images, and inline formatting.
 *
 * Syntax highlighting is loaded lazily — Shiki only initializes when the
 * document contains code blocks. Code blocks render immediately with plain
 * text, then re-render with highlighting once Shiki is ready.
 *
 * @example
 * ```tsx
 * <Markdown>{source}</Markdown>
 * ```
 *
 * @example
 * ```tsx
 * // Disable highlighting
 * <Markdown highlight={false}>{source}</Markdown>
 * ```
 *
 * @example
 * ```tsx
 * // Custom options
 * <Markdown highlight={{ langs: ["typescript", "python"] }}>{source}</Markdown>
 * ```
 * @category Markdown
 */
export const Markdown = React.memo(function Markdown({
  children,
  style,
  highlight,
}: MarkdownProps) {
  const ast = useMemo(() => parseMarkdown(children), [children]);
  const hasCode = useMemo(() => astHasCodeBlocks(ast), [ast]);

  // Determine if the user passed a ready-to-use highlighter instance
  const externalHighlighter =
    highlight && typeof highlight === "object" && "highlight" in highlight
      ? (highlight as Highlighter)
      : null;

  const disabled = highlight === false;

  const [lazyHighlighter, setLazyHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    if (disabled || externalHighlighter || !hasCode) return;

    let cancelled = false;

    const opts =
      highlight && typeof highlight === "object" && !("highlight" in highlight)
        ? (highlight as CreateHighlighterOptions)
        : undefined;

    import("./highlight.js").then(({ createHighlighter }) =>
      createHighlighter(opts).then((hl) => {
        if (!cancelled) setLazyHighlighter(hl);
      }),
    ).catch(() => {});

    return () => { cancelled = true; };
  }, [hasCode, disabled, externalHighlighter, highlight]);

  const activeHighlighter = externalHighlighter ?? lazyHighlighter;
  const ctx = useMemo<BlockCtx>(() => ({ highlighter: activeHighlighter ?? undefined }), [activeHighlighter]);

  return (
    <Box style={{ flexDirection: "column", gap: 1, ...style }}>
      {ast.children.map((node, i) => (
        <BlockNode key={i} node={node} ctx={ctx} />
      ))}
    </Box>
  );
});
