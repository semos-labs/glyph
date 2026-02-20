import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Parse a markdown string into an mdast AST.
 *
 * Supports GitHub Flavored Markdown (tables, task lists, strikethrough).
 * Uses `unified` with `remark-parse` and `remark-gfm`.
 *
 * @param source - Raw markdown string to parse.
 * @returns The parsed mdast root node.
 *
 * @example
 * ```ts
 * import { parseMarkdown } from "@semos-labs/glyph-markdown";
 *
 * const ast = parseMarkdown("# Hello **world**");
 * console.log(ast.children[0].type); // "heading"
 * ```
 * @category Markdown
 */
export function parseMarkdown(source: string): Root {
  return parser.parse(source) as Root;
}
