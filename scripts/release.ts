#!/usr/bin/env bun
/**
 * Release script for Glyph
 *
 * Usage:
 *   bun release           # Bump patch version (0.0.1 -> 0.0.2)
 *   bun release --minor   # Bump minor version (0.0.1 -> 0.1.0)
 *   bun release --major   # Bump major version (0.0.1 -> 1.0.0)
 */

import { $ } from "bun";

// ── Colors ──────────────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;

// ── Helpers ─────────────────────────────────────────────────────────────────

$.throws(false); // we handle errors ourselves

function ok(msg: string) { console.log(`  ${green("✓")} ${msg}`); }
function fail(msg: string) { console.error(`  ${red("✗")} ${msg}`); }
function warn(msg: string) { console.log(`  ${yellow("⚠")} ${msg}`); }

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help")) {
  console.log();
  console.log(`  ${bold("release")} ${dim("— tag & publish a new Glyph version")}`);
  console.log();
  console.log(`  ${bold("Usage:")}`);
  console.log(`    ${cyan("bun release")}           ${dim("patch bump  (0.0.1 → 0.0.2)")}`);
  console.log(`    ${cyan("bun release --minor")}   ${dim("minor bump  (0.0.1 → 0.1.0)")}`);
  console.log(`    ${cyan("bun release --major")}   ${dim("major bump  (0.0.1 → 1.0.0)")}`);
  console.log();
  process.exit(0);
}

const bumpType = args.includes("--major") ? "major"
  : args.includes("--minor") ? "minor"
  : "patch";

async function main() {
  console.log();

  // 1. Clean work tree
  const status = await $`git status --porcelain`.text();
  if (status.trim() !== "") {
    fail("Work tree is not clean — commit or stash first");
    console.log(dim(status.trimEnd().split("\n").map(l => `      ${l}`).join("\n")));
    console.log();
    process.exit(1);
  }

  // 2. Resolve current version from latest tag
  let latestTag: string;
  try {
    latestTag = (await $`git describe --tags --abbrev=0`.text()).trim();
  } catch {
    latestTag = "v0.0.0";
  }

  const m = latestTag.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    fail(`Invalid tag format: ${bold(latestTag)}`);
    console.log();
    process.exit(1);
  }

  let [, major, minor, patch] = m.map(Number);

  switch (bumpType) {
    case "major": major!++; minor = 0; patch = 0; break;
    case "minor": minor!++; patch = 0; break;
    case "patch": patch!++; break;
  }

  const version = `${major}.${minor}.${patch}`;
  const tag = `v${version}`;

  console.log(`  ${bold(latestTag)} ${dim("→")} ${bold(cyan(tag))} ${dim(`(${bumpType})`)}`);
  console.log();

  // 3. Update package.json files
  const packagePaths = [
    "./packages/glyph/package.json",
    "./packages/create-glyph/package.json",
  ];

  for (const pkgPath of packagePaths) {
    const pkg = await Bun.file(pkgPath).json();
    pkg.version = version;
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  ok("Updated package versions");

  // 4. Commit version bump
  for (const pkgPath of packagePaths) {
    await $`git add ${pkgPath}`;
  }
  const diff = await $`git diff --cached --name-only`.text();
  if (diff.trim()) {
    await $`git commit -m ${"chore: bump version to " + tag}`.quiet();
    ok("Committed version bump");
  } else {
    ok("Versions already up to date");
  }

  // 5. Tag
  await $`git tag -a ${tag} -m ${"Release " + tag}`;
  ok(`Tagged ${bold(tag)}`);

  // 6. Push
  await $`git push origin main`.quiet();
  await $`git push origin ${tag}`.quiet();
  ok("Pushed to origin");

  // 7. GitHub release
  const gh = await $`gh release create ${tag} --generate-notes --title ${tag}`.quiet();
  if (gh.exitCode === 0) {
    ok("Created GitHub release");
  } else {
    warn(`Could not create GitHub release — run manually:`);
    console.log(`      ${cyan(`gh release create ${tag} --generate-notes --title ${tag}`)}`);
  }

  console.log();
  console.log(`  ${dim("View:")} ${cyan(`https://github.com/semos-labs/glyph/releases/tag/${tag}`)}`);
  console.log();
}

main().catch((err) => {
  console.log();
  fail(err.message);
  console.log();
  process.exit(1);
});
