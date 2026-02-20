#!/usr/bin/env bun
/**
 * Post-process TypeDoc markdown for Starlight — **zero-config edition**.
 *
 * How it works:
 *   1. Reads `packages/glyph/src/index.ts` to learn every public export and
 *      which source file it comes from.
 *   2. Scans each source file for `@category <name>` JSDoc tags.  Tagged
 *      exports become **primary pages**.
 *   3. Un-tagged exports are auto-merged into a parent primary page using:
 *      a. Name-pattern matching (`FooProps → Foo`, `FooHandle → Foo`, …)
 *      b. TypeDoc cross-reference detection (e.g. "Props for the [Box](…)")
 *      c. Same-source-file fallback (first primary in the same file wins)
 *   4. Builds reorganised markdown under  components/ hooks/ utilities/ types/
 *   5. Rewrites all internal links.
 *
 * Adding a new component/hook:
 *   - Export it from `index.ts`
 *   - Add `@category Components` (or Hooks / Utilities / Types) to its JSDoc
 *   - Done — everything else is automatic.
 *
 * Usage:  bun scripts/postprocess-docs.ts [typedoc-output-dir]
 */

import {
  readdirSync, readFileSync, writeFileSync, mkdirSync,
  rmSync, existsSync, cpSync, statSync,
} from "node:fs";
import { join, relative, basename, dirname } from "node:path";

// ────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────

const TYPEDOC_DIR = process.argv[2] || ".docs-out";
const SRC_ROOT    = "packages/glyph/src";
const INDEX_FILE  = join(SRC_ROOT, "index.ts");

/** Canonical category names → output folder */
const CATEGORY_FOLDERS: Record<string, string> = {
  Layout:      "layout",
  Tables:      "tables",
  Form:        "form",
  Navigation:  "navigation",
  Keybindings: "keybindings",
  Feedback:    "feedback",
  Core:        "core",
};

// ────────────────────────────────────────────────────────────────────
// 1. Parse index.ts to learn: symbolName → sourceFile
// ────────────────────────────────────────────────────────────────────

interface ExportInfo {
  symbol: string;
  sourceFile: string; // relative to SRC_ROOT, e.g. "components/Box.tsx"
}

function resolveSourceFile(basePath: string): string {
  for (const ext of [".ts", ".tsx"]) {
    const candidate = join(SRC_ROOT, basePath + ext);
    if (existsSync(candidate)) return basePath + ext;
  }
  // Try as directory with index
  for (const ext of [".ts", ".tsx"]) {
    const candidate = join(SRC_ROOT, basePath, "index" + ext);
    if (existsSync(candidate)) return basePath + "/index" + ext;
  }
  return "";
}

/**
 * If a source file is a barrel (only re-exports, no declarations),
 * resolve each symbol to its actual declaration file.
 */
function resolveBarrelExports(sourceFile: string, symbols: string[]): ExportInfo[] {
  const content = readFileSync(join(SRC_ROOT, sourceFile), "utf-8");

  // Check if this file has any actual declarations (not just re-exports like `export type { ... }`)
  // The \w after the keyword ensures we match `export type Foo` but not `export type {`
  const hasDeclarations = /(?:^|\n)export\s+(?:const|function|interface|type|class|enum)\s+\w/m.test(content);
  if (hasDeclarations) {
    return symbols.map((s) => ({ symbol: s, sourceFile }));
  }

  // It's a barrel — resolve each symbol through re-exports
  const results: ExportInfo[] = [];
  const reExportRe = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;

  const reExportMap = new Map<string, string>();
  while ((m = reExportRe.exec(content)) !== null) {
    const syms = m[1]!.split(",").map((s) => s.trim()).filter(Boolean);
    const rawPath = m[2]!.replace(/\.js$/, "");
    // Resolve relative to the barrel file's directory
    const barrelDir = dirname(sourceFile);
    const resolvedBase = join(barrelDir, rawPath).replace(/\\/g, "/");
    const resolvedFile = resolveSourceFile(resolvedBase);
    if (resolvedFile) {
      for (const sym of syms) reExportMap.set(sym, resolvedFile);
    }
  }

  for (const sym of symbols) {
    const actualFile = reExportMap.get(sym);
    if (actualFile) {
      results.push({ symbol: sym, sourceFile: actualFile });
    } else {
      // Fallback: keep as barrel
      results.push({ symbol: sym, sourceFile });
    }
  }

  return results;
}

function parseIndexExports(indexPath: string): ExportInfo[] {
  const content = readFileSync(indexPath, "utf-8");
  const exports: ExportInfo[] = [];

  // Matches: export { Foo } from "./path.js"  and  export type { Foo, Bar } from "./path.js"
  const re = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(content)) !== null) {
    // Strip JS comments from the export list and split by comma
    const rawSymbols = m[1]!.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const symbols = rawSymbols.split(",").map((s) => s.trim()).filter(Boolean);
    const rawPath = m[2]!;
    const basePath = rawPath.replace(/\.js$/, "");
    const sourcePath = resolveSourceFile(basePath);
    if (!sourcePath) continue;

    // Resolve through barrels if needed
    const resolved = resolveBarrelExports(sourcePath, symbols);
    exports.push(...resolved);
  }

  return exports;
}

// ────────────────────────────────────────────────────────────────────
// 2. Scan source files for @category tags
// ────────────────────────────────────────────────────────────────────

interface CategoryTag {
  symbol: string;
  category: string;
}

function findCategoryTags(sourceFile: string, symbolsInFile: string[]): CategoryTag[] {
  const lines = readFileSync(join(SRC_ROOT, sourceFile), "utf-8").split("\n");
  const tags: CategoryTag[] = [];

  for (const sym of symbolsInFile) {
    // Find the export line for this symbol
    const exportIdx = lines.findIndex((line) => {
      const t = line.trimStart();
      return (
        t.startsWith(`export const ${sym} `) || t.startsWith(`export const ${sym}=`) || t.startsWith(`export const ${sym}:`) ||
        t.startsWith(`export function ${sym}(`) || t.startsWith(`export function ${sym}<`) || t.startsWith(`export function ${sym} `) ||
        t.startsWith(`export interface ${sym} `) || t.startsWith(`export interface ${sym}<`) || t.startsWith(`export interface ${sym}{`) ||
        t.startsWith(`export type ${sym} `) || t.startsWith(`export type ${sym}=`) || t.startsWith(`export type ${sym}<`) ||
        t.startsWith(`export class ${sym} `) || t.startsWith(`export class ${sym}{`) ||
        t.startsWith(`export enum ${sym} `) || t.startsWith(`export enum ${sym}{`)
      );
    });
    if (exportIdx < 0) continue;

    // Walk backwards to find the immediately preceding JSDoc block
    let jsdocEnd = -1;
    for (let i = exportIdx - 1; i >= 0; i--) {
      const trimmed = lines[i]!.trim();
      if (trimmed === "") continue;
      if (trimmed.endsWith("*/")) { jsdocEnd = i; break; }
      break; // hit non-blank, non-JSDoc line
    }
    if (jsdocEnd < 0) continue;

    // Find the JSDoc start
    let jsdocStart = -1;
    for (let i = jsdocEnd; i >= 0; i--) {
      if (lines[i]!.includes("/**")) { jsdocStart = i; break; }
    }
    if (jsdocStart < 0) continue;

    // Check for @category in this JSDoc block
    for (let i = jsdocStart; i <= jsdocEnd; i++) {
      const match = lines[i]!.match(/@category\s+(\w+)/);
      if (match) {
        tags.push({ symbol: sym, category: match[1]! });
        break;
      }
    }
  }

  return tags;
}

// ────────────────────────────────────────────────────────────────────
// 3. Build primary pages and merge map
// ────────────────────────────────────────────────────────────────────

interface PrimaryPage {
  symbol: string;
  category: string;
  slug: string;
  folder: string;
  mergedSymbols: string[]; // symbols that merge into this page
}

function toSlug(name: string): string {
  // PascalCase/camelCase → kebab-case
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Try to find the parent primary for an un-tagged symbol using name patterns.
 * Returns the primary symbol name or null.
 */
function matchByNamePattern(symbol: string, primaries: Map<string, PrimaryPage>): string | null {
  // Patterns: FooProps → Foo, FooHandle → Foo, FooItem → Foo, etc.
  const suffixes = ["Props", "Handle", "Item", "ItemInfo", "State", "Type"];
  for (const suffix of suffixes) {
    if (symbol.endsWith(suffix)) {
      const base = symbol.slice(0, -suffix.length);
      if (primaries.has(base)) return base;
    }
  }

  // UseFooOptions → useFoo, UseFooResult → useFoo
  const hookMatch = symbol.match(/^(Use\w+?)(Options|Result)$/);
  if (hookMatch) {
    const hookName = hookMatch[1]![0]!.toLowerCase() + hookMatch[1]!.slice(1);
    if (primaries.has(hookName)) return hookName;
  }

  // FooHostProps → FooHost (e.g. ToastHostProps → ToastHost)
  if (symbol.endsWith("HostProps")) {
    const base = symbol.slice(0, -"Props".length);
    if (primaries.has(base)) return base;
  }

  return null;
}

/**
 * Try to find parent by scanning TypeDoc output for cross-references like
 * "Props for the [Box](../variables/Box.md)"
 */
function matchByCrossRef(
  symbol: string,
  typedocFiles: Map<string, string>, // symbolName → typedocPath
  primaries: Map<string, PrimaryPage>,
): string | null {
  const tdPath = typedocFiles.get(symbol);
  if (!tdPath) return null;

  const fullPath = join(TYPEDOC_DIR, tdPath + ".md");
  if (!existsSync(fullPath)) return null;

  const content = readFileSync(fullPath, "utf-8");

  // Find markdown links: [SomePrimary](../variables/SomePrimary.md)
  const linkRe = /\[(\w+)\]\([^)]+\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(content)) !== null) {
    const linked = m[1]!;
    if (primaries.has(linked) && linked !== symbol) {
      return linked;
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────
// 4. TypeDoc file discovery: symbolName → typedoc relative path
// ────────────────────────────────────────────────────────────────────

function discoverTypedocFiles(dir: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const group of ["variables", "functions", "interfaces", "type-aliases"]) {
    const groupDir = join(dir, group);
    if (!existsSync(groupDir)) continue;

    for (const file of readdirSync(groupDir)) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(/\.md$/, "");
      map.set(name, `${group}/${name}`);
    }
  }

  return map;
}

// ────────────────────────────────────────────────────────────────────
// 5. Markdown helpers (same as before, but extracted)
// ────────────────────────────────────────────────────────────────────

function extractBody(raw: string): string {
  const lines = raw.split("\n");
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.match(/^#\s+/)) { headingIdx = i; break; }
  }
  const body = headingIdx >= 0 ? lines.slice(headingIdx + 1) : lines;
  while (body.length > 0 && body[0]!.trim() === "") body.shift();
  return body.join("\n").trimEnd();
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^(Variable|Function|Interface|Type Alias|Class|Enum|Namespace):\s*/i, "")
    .replace(/\(\)$/, "")
    .replace(/\\([<>])/g, "$1")
    .trim();
}

function extractTitle(raw: string): string {
  const match = raw.match(/^#\s+(.+)$/m);
  return match ? cleanTitle(match[1]!) : "";
}

function escapeYaml(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

// ────────────────────────────────────────────────────────────────────
// 6. Link rewriting
// ────────────────────────────────────────────────────────────────────

function buildLinkMap(
  primaries: Map<string, PrimaryPage>,
  typedocFiles: Map<string, string>,
): Map<string, { target: string; anchor?: string }> {
  const linkMap = new Map<string, { target: string; anchor?: string }>();

  for (const [, page] of primaries) {
    const destPath = `${page.folder}/${page.slug}`;

    // Primary symbol
    const tdKey = typedocFiles.get(page.symbol);
    if (tdKey) linkMap.set(tdKey, { target: destPath });

    // Merged symbols → same page with anchor
    for (const merged of page.mergedSymbols) {
      const mKey = typedocFiles.get(merged);
      if (mKey) {
        // Props types have their heading stripped — the anchor becomes #properties
        const anchor = merged.endsWith("Props") ? "properties" : toAnchor(merged);
        linkMap.set(mKey, { target: destPath, anchor });
      }
    }
  }

  return linkMap;
}

function toAnchor(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * @param content    — markdown to rewrite
 * @param origDir    — the original TypeDoc directory of this content (e.g. "interfaces")
 * @param destPage   — the FULL destination page path (e.g. "components/jump-nav")
 *                     Starlight serves each .md as a directory, so relative links
 *                     must be computed from the page path, not its parent folder.
 * @param linkMap    — mapping from TypeDoc path → new path
 */
function rewriteLinks(
  content: string,
  origDir: string,
  destPage: string,
  linkMap: Map<string, { target: string; anchor?: string }>,
): string {
  return content.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text, href) => {
    if (href.startsWith("http") || href.startsWith("#")) return match;

    const [pathPart, anchorPart] = href.split("#") as [string, string | undefined];
    // Resolve relative to the ORIGINAL TypeDoc directory
    const resolved = resolveTypedocKey(pathPart!, origDir);
    if (!resolved) return match;

    const mapping = linkMap.get(resolved);
    if (!mapping) return match;

    // Build path relative to the DESTINATION page (not folder).
    // Starlight treats each page as a directory, so from "components/jump-nav"
    // to "components/focus-scope" we need "../focus-scope", not "focus-scope".
    const newRel = relative(destPage, mapping.target);

    // Self-reference: link points to the current page
    if (!newRel) {
      const finalAnchor = mapping.anchor || anchorPart;
      if (finalAnchor) return `[${text}](#${finalAnchor})`;
      return text; // plain text, no link needed
    }

    const finalAnchor = mapping.anchor || anchorPart;
    const finalHref = finalAnchor ? `${newRel}#${finalAnchor}` : newRel;

    return `[${text}](${finalHref})`;
  });
}

function resolveTypedocKey(relPath: string, fromDir: string): string | null {
  let cleaned = relPath.replace(/\.md$/, "");

  if (cleaned.startsWith("../") || cleaned.startsWith("./")) {
    // Explicitly relative path
    const parts = fromDir ? fromDir.split("/") : [];
    const refParts = cleaned.split("/");
    for (const part of refParts) {
      if (part === "..") parts.pop();
      else if (part !== ".") parts.push(part);
    }
    cleaned = parts.join("/");
  } else if (!cleaned.includes("/") && fromDir) {
    // Plain filename like "Style" — resolve relative to the current TypeDoc directory
    cleaned = fromDir + "/" + cleaned;
  }

  return cleaned || null;
}

// ────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────

console.log("📖 Post-processing TypeDoc output...\n");

// Step 1: Parse index.ts
const allExports = parseIndexExports(INDEX_FILE);
console.log(`   Found ${allExports.length} exports from index.ts`);

// Group by source file
const bySourceFile = new Map<string, string[]>();
for (const exp of allExports) {
  const arr = bySourceFile.get(exp.sourceFile) || [];
  arr.push(exp.symbol);
  bySourceFile.set(exp.sourceFile, arr);
}

// Step 2: Scan for @category tags
const primaries = new Map<string, PrimaryPage>();
const allCategories = new Set<string>();

for (const [sourceFile, symbols] of bySourceFile) {
  const tags = findCategoryTags(sourceFile, symbols);
  for (const tag of tags) {
    const folder = CATEGORY_FOLDERS[tag.category];
    if (!folder) {
      console.warn(`   ⚠  Unknown category "${tag.category}" on ${tag.symbol}`);
      continue;
    }
    allCategories.add(tag.category);
    primaries.set(tag.symbol, {
      symbol: tag.symbol,
      category: tag.category,
      slug: toSlug(tag.symbol),
      folder,
      mergedSymbols: [],
    });
  }
}
console.log(`   Found ${primaries.size} primary pages (with @category)`);

// Step 3: Discover TypeDoc files
const typedocFiles = discoverTypedocFiles(TYPEDOC_DIR);
console.log(`   Found ${typedocFiles.size} TypeDoc markdown files`);

// Step 4: Merge un-tagged symbols into primaries
const symbolToSource = new Map<string, string>();
for (const exp of allExports) {
  symbolToSource.set(exp.symbol, exp.sourceFile);
}

const untagged = allExports
  .filter((e) => !primaries.has(e.symbol))
  .map((e) => e.symbol);

let mergedCount = 0;
let orphanCount = 0;
const orphans: string[] = [];

for (const sym of untagged) {
  // a) Name pattern matching
  let parent = matchByNamePattern(sym, primaries);

  // b) Cross-reference detection
  if (!parent) {
    parent = matchByCrossRef(sym, typedocFiles, primaries);
  }

  // c) Same source file fallback
  if (!parent) {
    const srcFile = symbolToSource.get(sym);
    if (srcFile) {
      // Find primaries from the same file
      const filePrimaries = [...primaries.values()].filter((p) => {
        const pSrc = symbolToSource.get(p.symbol);
        return pSrc === srcFile;
      });

      if (filePrimaries.length === 1) {
        parent = filePrimaries[0]!.symbol;
      } else if (filePrimaries.length > 1) {
        // Multiple primaries in same file — try longest prefix match
        let bestMatch: string | null = null;
        let bestLen = 0;
        for (const fp of filePrimaries) {
          // Check if the symbol starts with the primary name
          if (sym.startsWith(fp.symbol) && fp.symbol.length > bestLen) {
            bestMatch = fp.symbol;
            bestLen = fp.symbol.length;
          }
        }
        parent = bestMatch || filePrimaries[0]!.symbol;
      }
    }
  }

  if (parent) {
    primaries.get(parent)!.mergedSymbols.push(sym);
    mergedCount++;
  } else {
    orphans.push(sym);
    orphanCount++;
  }
}

console.log(`   Merged ${mergedCount} sub-types into parent pages`);
if (orphanCount > 0) {
  console.warn(`   ⚠  ${orphanCount} orphaned symbols (no parent found): ${orphans.join(", ")}`);
}

// Step 5: Build output
const outDir = TYPEDOC_DIR + "-organized";
if (existsSync(outDir)) rmSync(outDir, { recursive: true });

for (const folder of Object.values(CATEGORY_FOLDERS)) {
  mkdirSync(join(outDir, folder), { recursive: true });
}

// Build link map
const linkMap = buildLinkMap(primaries, typedocFiles);

let generated = 0;

for (const [, page] of primaries) {
  const parts: string[] = [];

  // Frontmatter
  parts.push("---");
  parts.push(`title: ${escapeYaml(page.symbol)}`);
  parts.push("---");
  parts.push("");

  // Primary source — rewrite links using its original TypeDoc directory
  const primaryTd = typedocFiles.get(page.symbol);
  if (primaryTd) {
    const fullPath = join(TYPEDOC_DIR, primaryTd + ".md");
    if (existsSync(fullPath)) {
      const raw = readFileSync(fullPath, "utf-8");
      const body = extractBody(raw);
      // Rewrite links — use full page path so Starlight's directory routing works
      const destPage = `${page.folder}/${page.slug}`;
      parts.push(rewriteLinks(body, dirname(primaryTd), destPage, linkMap));
    }
  }

  // Merged sources
  for (const merged of page.mergedSymbols) {
    const td = typedocFiles.get(merged);
    if (!td) continue;
    const fullPath = join(TYPEDOC_DIR, td + ".md");
    if (!existsSync(fullPath)) continue;

    const raw = readFileSync(fullPath, "utf-8");
    const title = extractTitle(raw);
    let body = extractBody(raw);

    if (!body.trim()) continue;

    const mergedDestPage = `${page.folder}/${page.slug}`;

    // For Props types: strip the heading and the "Props for the [X]…" description.
    // Keep only the ## Properties table and everything below it.
    if (merged.endsWith("Props")) {
      const headingMatch = body.match(/^## /m);
      if (headingMatch && headingMatch.index != null) {
        body = body.slice(headingMatch.index);
      }
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push(rewriteLinks(body, dirname(td), mergedDestPage, linkMap));
    } else {
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push(`## ${title || merged}`);
      parts.push("");
      parts.push(rewriteLinks(body, dirname(td), mergedDestPage, linkMap));
    }
  }

  // Clean up stray TypeDoc artifacts
  const content = parts.join("\n")
    .replace(/^ \*$/gm, "")  // stray " *" lines from TypeDoc
    .replace(/\n{3,}/g, "\n\n"); // collapse excessive blank lines

  const filePath = join(outDir, page.folder, page.slug + ".md");
  writeFileSync(filePath, content.trimEnd() + "\n", "utf-8");
  generated++;
  console.log(`   ✓ ${page.folder}/${page.slug}.md (+ ${page.mergedSymbols.length} merged)`);
}

// ────────────────────────────────────────────────────────────────────
// Sort priority: Components → Hooks → Utilities → Types (then alpha)
// ────────────────────────────────────────────────────────────────────

function sortPriority(symbol: string, typedocFiles: Map<string, string>): number {
  const tdKey = typedocFiles.get(symbol);
  const isPascalCase = /^[A-Z]/.test(symbol);
  const isHook = symbol.startsWith("use");
  const isType = tdKey?.startsWith("interfaces/") || tdKey?.startsWith("type-aliases/");

  if (isPascalCase && !isType) return 0;  // Components (PascalCase non-types)
  if (isHook) return 1;                    // Hooks (use*)
  if (!isPascalCase && !isType) return 2;  // Utility functions & constants
  if (isType) return 3;                    // Types

  return 4;
}

function comparePrimaries(
  a: PrimaryPage,
  b: PrimaryPage,
  tdFiles: Map<string, string>,
): number {
  const pa = sortPriority(a.symbol, tdFiles);
  const pb = sortPriority(b.symbol, tdFiles);
  if (pa !== pb) return pa - pb;
  return a.symbol.localeCompare(b.symbol);
}

// Step 6: Generate index
const categoryLabels: Record<string, string> = {
  Layout:      "Layout",
  Tables:      "Tables",
  Form:        "Form",
  Navigation:  "Navigation",
  Keybindings: "Keybindings",
  Feedback:    "Feedback",
  Core:        "Core",
};

const indexParts: string[] = [
  "---",
  "title: 'API Reference'",
  "---",
  "",
  "Complete API reference for `@semos-labs/glyph`.",
  "",
];

for (const [catName, folder] of Object.entries(CATEGORY_FOLDERS)) {
  const catPages = [...primaries.values()]
    .filter((p) => p.category === catName)
    .sort((a, b) => comparePrimaries(a, b, typedocFiles));

  if (catPages.length === 0) continue;

  indexParts.push(`## ${categoryLabels[catName] || catName}`);
  indexParts.push("");
  for (const p of catPages) {
    indexParts.push(`- [${p.symbol}](${folder}/${p.slug}/)`);
  }
  indexParts.push("");
}

writeFileSync(join(outDir, "index.md"), indexParts.join("\n"), "utf-8");
console.log("   ✓ index.md");

// Step 7: Generate sidebar
const sidebar = Object.entries(CATEGORY_FOLDERS)
  .map(([catName, folder]) => ({
    label: categoryLabels[catName] || catName,
    items: [...primaries.values()]
      .filter((p) => p.category === catName)
      .sort((a, b) => comparePrimaries(a, b, typedocFiles))
      .map((p) => ({ label: p.symbol, link: `/glyph/api/${folder}/${p.slug}/` })),
  }))
  .filter((g) => g.items.length > 0);

writeFileSync(join(outDir, "sidebar.json"), JSON.stringify(sidebar, null, 2), "utf-8");
console.log("   ✓ sidebar.json");

// Step 8: Replace original output
rmSync(TYPEDOC_DIR, { recursive: true });
cpSync(outDir, TYPEDOC_DIR, { recursive: true });
rmSync(outDir, { recursive: true });

console.log(`\n✅ Organized ${generated} pages into ${TYPEDOC_DIR}`);
console.log(`   No hardcoded config — everything discovered from @category tags + naming conventions.\n`);

