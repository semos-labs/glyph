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

// Parse arguments
const args = process.argv.slice(2);
const bumpType = args.includes("--major") ? "major" 
              : args.includes("--minor") ? "minor" 
              : "patch";

async function main() {
  console.log("🚀 Starting release process...\n");

  // 1. Check if work tree is clean
  console.log("📋 Checking work tree...");
  const status = await $`git status --porcelain`.text();
  
  if (status.trim() !== "") {
    console.error("❌ Work tree is not clean. Please commit or stash your changes first.");
    console.error("\nUncommitted changes:");
    console.error(status);
    process.exit(1);
  }
  console.log("✅ Work tree is clean\n");

  // 2. Get latest tag
  console.log("🏷️  Getting latest tag...");
  let latestTag: string;
  try {
    latestTag = (await $`git describe --tags --abbrev=0`.text()).trim();
  } catch {
    // No tags exist yet, start from v0.0.0
    latestTag = "v0.0.0";
    console.log("   No existing tags found, starting from v0.0.0");
  }
  console.log(`   Latest tag: ${latestTag}\n`);

  // 3. Parse and bump version
  const versionMatch = latestTag.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!versionMatch) {
    console.error(`❌ Invalid tag format: ${latestTag}. Expected v0.0.0 format.`);
    process.exit(1);
  }

  let [, major, minor, patch] = versionMatch.map(Number);
  
  switch (bumpType) {
    case "major":
      major!++;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor!++;
      patch = 0;
      break;
    case "patch":
      patch!++;
      break;
  }

  const newVersion = `v${major}.${minor}.${patch}`;
  console.log(`📦 Bumping ${bumpType} version: ${latestTag} → ${newVersion}\n`);

  // 4. Update package.json versions (glyph + create-glyph)
  console.log("📝 Updating package versions...");
  const versionStr = `${major}.${minor}.${patch}`;

  const packagePaths = [
    "./packages/glyph/package.json",
    "./packages/create-glyph/package.json",
  ];

  for (const pkgPath of packagePaths) {
    const pkg = await Bun.file(pkgPath).json();
    pkg.version = versionStr;
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`   ${pkg.name} → ${versionStr}`);
  }
  console.log();

  // 5. Commit the version bump
  console.log("💾 Committing version bump...");
  await $`git add ${packagePaths.join(" ")}`;
  await $`git commit -m "chore: bump version to ${newVersion}"`;
  console.log("✅ Committed\n");

  // 6. Create and push tag
  console.log(`🏷️  Creating tag ${newVersion}...`);
  await $`git tag -a ${newVersion} -m "Release ${newVersion}"`;
  console.log("✅ Tag created\n");

  console.log("⬆️  Pushing to origin...");
  await $`git push origin main`;
  await $`git push origin ${newVersion}`;
  console.log("✅ Pushed\n");

  // 7. Create GitHub release
  console.log("📢 Creating GitHub release...");
  try {
    await $`gh release create ${newVersion} --generate-notes --title ${newVersion}`;
    console.log("✅ GitHub release created\n");
  } catch (err) {
    console.error("⚠️  Failed to create GitHub release. You may need to create it manually.");
    console.error("   Make sure 'gh' CLI is installed and authenticated.");
    console.error(`   Run: gh release create ${newVersion} --generate-notes --title ${newVersion}\n`);
  }

  console.log(`🎉 Release ${newVersion} complete!`);
  console.log(`   View at: https://github.com/nick-skriabin/glyph/releases/tag/${newVersion}`);
}

main().catch((err) => {
  console.error("❌ Release failed:", err.message);
  process.exit(1);
});
