#!/usr/bin/env bun
/**
 * Post-process TypeDoc markdown output for Starlight compatibility.
 *
 * - Extracts the `# Title` heading and injects YAML frontmatter
 * - Strips the breadcrumb line and `***` separator TypeDoc adds
 * - Cleans up "Variable: X" / "Function: X()" prefixes in titles
 *
 * Usage:
 *   bun scripts/postprocess-docs.ts [dir]
 *   (default dir: .docs-out)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] || ".docs-out";

function walk(dirPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

/** Clean TypeDoc title prefixes like "Variable: Box" → "Box" */
function cleanTitle(raw: string): string {
  return raw
    .replace(/^(Variable|Function|Interface|Type Alias|Class|Enum|Namespace):\s*/i, "")
    .replace(/\(\)$/, "") // strip trailing ()
    .replace(/\\([<>])/g, "$1") // unescape \< \> from TypeDoc generics
    .trim();
}

function escapeYaml(s: string): string {
  // Always wrap in single quotes for safety — handles <, >, :, #, etc.
  // Single-quote escaping: double any internal single quotes
  return `'${s.replace(/'/g, "''")}'`;
}

let processed = 0;

for (const file of walk(dir)) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");

  // Find the first `# ` heading
  let titleLineIdx = -1;
  let title = "";
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(/^#\s+(.+)$/);
    if (match) {
      titleLineIdx = i;
      title = cleanTitle(match[1]!);
      break;
    }
  }

  if (titleLineIdx === -1) continue; // skip files without headings

  // Strip everything before and including the title line:
  //   - breadcrumb link line (e.g. [**@semos-labs/glyph**](../index.md))
  //   - *** separator
  //   - the # heading itself (frontmatter replaces it)
  // Keep everything after
  const bodyLines = lines.slice(titleLineIdx + 1);

  // Remove leading blank lines from body
  while (bodyLines.length > 0 && bodyLines[0]!.trim() === "") {
    bodyLines.shift();
  }

  const frontmatter = [
    "---",
    `title: ${escapeYaml(title)}`,
    "---",
    "",
  ].join("\n");

  writeFileSync(file, frontmatter + bodyLines.join("\n"), "utf-8");
  processed++;
}

console.log(`✅ Post-processed ${processed} files in ${dir}`);
