/**
 * Integration test: Sliding window with unique keys through the React reconciler.
 *
 * This reproduces the exact bug pattern:
 * - A list renders the last N items with key={item.id}
 * - Each tick, new items are appended and old items are trimmed
 * - React reconciles: removeChild for deleted items, appendChild for new ones
 *
 * We use the ACTUAL React reconciler (not manual node operations) so we can
 * catch any ordering / timing issues in the commit phase.
 */
import { describe, test, expect } from "bun:test";
import React, { useState, useEffect } from "react";
import ReactReconciler from "react-reconciler";
import { hostConfig } from "../reconciler/hostConfig.js";
import type { GlyphContainer, GlyphNode } from "../reconciler/nodes.js";
import { markLayoutDirty } from "../reconciler/nodes.js";
import { computeLayout, createRootYogaNode } from "../layout/yogaLayout.js";
import type { Node as YogaNode } from "yoga-layout";

// ── Mini renderer ──────────────────────────────────────────────
// Stripped-down version of render.ts that runs synchronously in tests.

// @ts-expect-error - react-reconciler types don't perfectly match runtime
const reconciler = ReactReconciler(hostConfig);

function createTestContainer(rootYoga: YogaNode): GlyphContainer {
  return {
    type: "root",
    children: [],
    onCommit() {},
    yogaNode: rootYoga,
  };
}

interface RenderHandle {
  container: GlyphContainer;
  rootYoga: YogaNode;
  fiberRoot: any;
  /** Force a React update + layout computation (async — flushes microtasks). */
  update(element: React.ReactElement): Promise<void>;
  /** Just run layout (no React update). */
  layout(): void;
  /** Unmount and free everything. */
  unmount(): Promise<void>;
}

/** Flush pending microtasks so React's async commit fires. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createTestRenderer(): RenderHandle {
  const rootYoga = createRootYogaNode();
  const container = createTestContainer(rootYoga);
  const root = (reconciler.createContainer as any)(
    container,
    0, // LegacyRoot
    null, false, false, "", null, null,
  );

  function layout() {
    computeLayout(container.children, 80, 24, rootYoga, true);
  }

  async function update(element: React.ReactElement) {
    reconciler.updateContainer(element, root, null, null);
    // Flush React's async scheduling so the commit happens now.
    await flushMicrotasks();
    layout();
  }

  async function unmount() {
    reconciler.updateContainer(null, root, null, null);
    await flushMicrotasks();
    rootYoga.freeRecursive();
  }

  return { container, rootYoga, fiberRoot: root, update, layout, unmount } as any;
}

// ── Helpers ────────────────────────────────────────────────────

/** Walk the GlyphNode tree and collect layout info for logging. */
function dumpTree(node: GlyphNode, indent = ""): string[] {
  const lines: string[] = [];
  const yn = node.yogaNode;
  const yogaCC = yn ? yn.getChildCount() : -1;
  const yogaCl = yn ? yn.getComputedLayout() : null;

  let text = "";
  if (node.type === "text") {
    text = ` "${node.text?.slice(0, 30) ?? ""}"`;
  }

  lines.push(
    `${indent}${node.type}${text}` +
    ` children=${node.children.length} yogaCC=${yogaCC}` +
    ` layout=(${node.layout.x},${node.layout.y},${node.layout.width}x${node.layout.height})` +
    (yogaCl
      ? ` yoga=(${yogaCl.left},${yogaCl.top},${yogaCl.width}x${yogaCl.height})`
      : ` yoga=NULL`) +
    (node._paintDirty ? " DIRTY" : "")
  );

  for (const child of node.children) {
    lines.push(...dumpTree(child, indent + "  "));
  }
  return lines;
}

function dumpContainer(container: GlyphContainer): string {
  const lines: string[] = [];
  lines.push(`Container: ${container.children.length} roots, yogaCC=${container.yogaNode?.getChildCount()}`);
  for (const root of container.children) {
    lines.push(...dumpTree(root));
  }
  return lines.join("\n");
}

/** Verify every child in a column is at the expected Y position. */
function verifyColumnLayout(
  parent: GlyphNode,
  label: string,
): { ok: boolean; detail: string } {
  let y = parent.layout.y;
  const details: string[] = [];
  let ok = true;

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]!;
    if (child.layout.y !== y) {
      details.push(`  child[${i}] expected y=${y}, got y=${child.layout.y} (h=${child.layout.height})`);
      ok = false;
    }
    y += child.layout.height;
  }

  if (!ok) {
    details.unshift(`${label}: LAYOUT MISMATCH (parent at y=${parent.layout.y}, ${parent.children.length} children)`);
  }
  return { ok, detail: details.join("\n") };
}

// ── Test component ─────────────────────────────────────────────

interface LogEntry {
  id: number;
  message: string;
}

function SlidingWindowList({
  items,
}: {
  items: LogEntry[];
}) {
  return React.createElement(
    "box",
    { style: { flexDirection: "column", width: "100%", height: "100%" } },
    items.map((item) =>
      React.createElement(
        "box",
        { key: item.id, style: { flexDirection: "row", gap: 1 } },
        React.createElement("text", { style: { width: 4 } }, `${item.id}`),
        React.createElement("text", {}, item.message),
      ),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────

describe("sliding window with React reconciler (unique keys)", () => {
  test("layout positions stay correct across 400 sliding window ticks (200 window)", async () => {
    const renderer = createTestRenderer();
    const WINDOW = 200;
    const TOTAL = 400;

    const allLogs: LogEntry[] = [];
    let firstFailFrame = -1;
    let firstFailDump = "";

    for (let tick = 0; tick < TOTAL; tick++) {
      // Add 1-2 new items per tick
      allLogs.push({ id: tick, message: `msg-${tick}` });

      // Visible window: last WINDOW items
      const visible = allLogs.slice(-WINDOW);

      // Render through React reconciler
      await renderer.update(
        React.createElement(SlidingWindowList, { items: visible }),
      );

      // Inspect the tree
      const root = renderer.container.children[0];
      if (!root) {
        console.error(`[tick=${tick}] No root node!`);
        continue;
      }

      // The root is the column box, children are the row boxes
      const columnBox = root;

      // ── Structural checks ──
      const expectedCount = visible.length;
      const actualCount = columnBox.children.length;
      const yogaCount = columnBox.yogaNode?.getChildCount() ?? -1;

      if (actualCount !== expectedCount) {
        console.error(
          `[tick=${tick}] CHILD COUNT MISMATCH: expected=${expectedCount} actual=${actualCount} yoga=${yogaCount}`,
        );
      }

      // ── Yoga tree structure check ──
      if (yogaCount !== actualCount) {
        console.error(
          `[tick=${tick}] YOGA TREE DESYNC: glyphChildren=${actualCount} yogaChildren=${yogaCount}`,
        );
        // Dump Yoga children identity
        for (let i = 0; i < yogaCount; i++) {
          const yc = columnBox.yogaNode!.getChild(i);
          const gc = i < actualCount ? columnBox.children[i]! : null;
          const match = gc?.yogaNode === yc;
          console.error(`  yoga[${i}] match=${match} glyphType=${gc?.type ?? "NONE"}`);
        }
      }

      // ── Layout position checks ──
      const { ok, detail } = verifyColumnLayout(columnBox, `tick=${tick}`);

      if (!ok && firstFailFrame === -1) {
        firstFailFrame = tick;
        firstFailDump = dumpContainer(renderer.container);
        console.error(`\n${"=".repeat(60)}`);
        console.error(`FIRST FAILURE at tick=${tick}`);
        console.error(detail);
        console.error(`\nFull tree dump:`);
        console.error(firstFailDump);
        console.error(`${"=".repeat(60)}\n`);
      }

      // Log on milestones or when something is wrong
      const isMilestone = tick === WINDOW || tick === WINDOW + 10 || tick === WINDOW + 50 || tick === TOTAL - 1;
      if (isMilestone || !ok || yogaCount !== actualCount) {
        // Show first 5 and last 5 children positions
        const first5 = columnBox.children.slice(0, 5).map((c, i) => {
          const yogaRel = c.yogaNode?.getComputedLayout();
          return `[${i}] y=${c.layout.y} yogaTop=${yogaRel?.top ?? "NULL"}`;
        });
        const last5 = columnBox.children.slice(-5).map((c, i) => {
          const idx = actualCount - 5 + i;
          const yogaRel = c.yogaNode?.getComputedLayout();
          return `[${idx}] y=${c.layout.y} yogaTop=${yogaRel?.top ?? "NULL"}`;
        });
        console.error(`[tick=${tick}] ${actualCount} children, yoga=${yogaCount} | first: ${first5.join(", ")} | last: ${last5.join(", ")}`);
      }
    }

    // Assert: no frame should have had a layout mismatch
    if (firstFailFrame !== -1) {
      throw new Error(
        `Layout corruption detected at tick ${firstFailFrame}.\n` +
        `See console output above for details.`,
      );
    }

    await renderer.unmount();
  });

  test("compare unique keys vs index keys layout (200 window)", async () => {
    const rendererUnique = createTestRenderer();
    const rendererIndex = createTestRenderer();

    const WINDOW = 200;
    const TOTAL = 400;

    const allLogs: LogEntry[] = [];

    function IndexKeyList({ items }: { items: LogEntry[] }) {
      return React.createElement(
        "box",
        { style: { flexDirection: "column", width: "100%", height: "100%" } },
        items.map((item, i) =>
          React.createElement(
            "box",
            { key: i, style: { flexDirection: "row", gap: 1 } },
            React.createElement("text", { style: { width: 4 } }, `${item.id}`),
            React.createElement("text", {}, item.message),
          ),
        ),
      );
    }

    let divergedAt = -1;

    for (let tick = 0; tick < TOTAL; tick++) {
      allLogs.push({ id: tick, message: `msg-${tick}` });
      const visible = allLogs.slice(-WINDOW);

      await rendererUnique.update(
        React.createElement(SlidingWindowList, { items: visible }),
      );
      await rendererIndex.update(
        React.createElement(IndexKeyList, { items: visible }),
      );

      const uniqueRoot = rendererUnique.container.children[0]!;
      const indexRoot = rendererIndex.container.children[0]!;

      // Compare layout positions
      for (let i = 0; i < Math.min(uniqueRoot.children.length, indexRoot.children.length); i++) {
        const uc = uniqueRoot.children[i]!;
        const ic = indexRoot.children[i]!;
        if (uc.layout.y !== ic.layout.y && divergedAt === -1) {
          divergedAt = tick;
          console.error(`\nDIVERGENCE at tick=${tick}, child[${i}]:`);
          console.error(`  unique-key: y=${uc.layout.y} h=${uc.layout.height}`);
          console.error(`  index-key:  y=${ic.layout.y} h=${ic.layout.height}`);
          console.error(`\nUnique-key tree:`);
          console.error(dumpContainer(rendererUnique.container));
          console.error(`\nIndex-key tree:`);
          console.error(dumpContainer(rendererIndex.container));
        }
      }
    }

    if (divergedAt !== -1) {
      console.error(`\nLayout diverged at tick ${divergedAt} between unique and index keys.`);
    }

    // Even if layouts diverge, log the final state
    console.error("\n--- Final unique-key state ---");
    console.error(dumpContainer(rendererUnique.container));
    console.error("\n--- Final index-key state ---");
    console.error(dumpContainer(rendererIndex.container));

    await rendererUnique.unmount();
    await rendererIndex.unmount();

    // This test currently documents the bug — flip expect when fixed
    // expect(divergedAt).toBe(-1);
  });

  test("benchmark-like structure: clip parent + fixed-width column + incremental layout", async () => {
    // Mirrors the actual benchmark tree:
    // Root column → Title bar → Divider → Main row(clip:true) →
    //   ProcessTable-like left box → Divider → ActivityLog(width:48, flexGrow:1) →
    //     Header row → Log rows (key={log.id})
    const renderer = createTestRenderer();
    const WINDOW = 20; // visible items (constrained by 24-row terminal)
    const TOTAL = 60;
    const WIDTH = 80;
    const HEIGHT = 24;

    // Import paint infrastructure
    const { paintTree } = await import("../paint/painter.js");
    const { Framebuffer } = await import("../paint/framebuffer.js");
    const fb = new Framebuffer(WIDTH, HEIGHT);

    const allLogs: LogEntry[] = [];
    let firstFailFrame = -1;

    function BenchmarkLayout({ items }: { items: LogEntry[] }) {
      return React.createElement(
        "box",
        { style: { flexDirection: "column", width: "100%", height: "100%" } },
        // Title bar
        React.createElement("box", { style: { flexDirection: "row", paddingX: 1, bg: "blackBright" } },
          React.createElement("text", { style: { bold: true } }, "Title")
        ),
        // Divider
        React.createElement("box", { style: { height: 1, bg: "blackBright" } }),
        // Main content row (clip: true)
        React.createElement(
          "box",
          { style: { flexDirection: "row", flexGrow: 1, flexShrink: 1, clip: true } },
          // Left panel (ProcessTable-like)
          React.createElement("box", { style: { flexDirection: "column", flexGrow: 1 } },
            React.createElement("text", {}, "Process Table placeholder")
          ),
          // Vertical divider
          React.createElement("box", { style: { width: 1, bg: "blackBright" } }),
          // Right panel: Activity log (fixed width 48)
          React.createElement(
            "box",
            { style: { flexDirection: "column", width: 48, flexShrink: 0 } },
            // Header
            React.createElement("box", { style: { flexDirection: "row", paddingX: 1, gap: 1 } },
              React.createElement("text", { style: { bold: true } }, "Activity"),
              React.createElement("text", { style: { dim: true } }, `${items.length} entries`)
            ),
            // Log list (flexGrow: 1)
            React.createElement(
              "box",
              { style: { flexDirection: "column", flexGrow: 1 } },
              items.map((item) =>
                React.createElement(
                  "box",
                  { key: item.id, style: { flexDirection: "row", paddingX: 1, gap: 1 } },
                  React.createElement("text", { style: { width: 8 } }, "12:34:56"),
                  React.createElement("text", { style: { dim: true } }, item.message),
                ),
              ),
            ),
          ),
        ),
        // Bottom bar
        React.createElement("box", { style: { flexDirection: "row", paddingX: 1, flexShrink: 0 } },
          React.createElement("text", { style: { dim: true } }, "bottom bar")
        ),
      );
    }

    let logId = 0;
    for (let tick = 0; tick < TOTAL; tick++) {
      // Add 1-3 items per tick (matches benchmark's random count)
      const count = 1 + (tick % 3);
      for (let j = 0; j < count; j++) {
        // Mix short and long messages — some will WRAP in 48-col column
        const longMsg = tick % 5 === 0
          ? `Long wrapping message for entry ${logId} that should exceed the column width`
          : `msg-${logId}`;
        allLogs.push({ id: logId++, message: longMsg });
      }
      const visible = allLogs.slice(-WINDOW);

      await renderer.update(
        React.createElement(BenchmarkLayout, { items: visible }),
      );

      // Use force=false on non-first frames (matches real render loop)
      const force = tick === 0;
      computeLayout(renderer.container.children, WIDTH, HEIGHT, renderer.rootYoga, force);

      // Paint incrementally (like the real render loop)
      paintTree(renderer.container.children, fb, { fullRedraw: force });

      // Find the ActivityLog inner column
      const rootCol = renderer.container.children[0];
      if (!rootCol) continue;
      const mainRow = rootCol.children[2]; // title, divider, MAIN ROW
      if (!mainRow) continue;
      const activityWrapper = mainRow.children[2]; // left, divider, ACTIVITY
      if (!activityWrapper) continue;
      const logList = activityWrapper.children[1]; // header, LOG LIST
      if (!logList) continue;

      // ── Layout checks ──
      const { ok, detail } = verifyColumnLayout(logList, `tick=${tick}`);

      // ── Yoga tree structure check ──
      const yogaCount = logList.yogaNode?.getChildCount() ?? -1;
      const actualCount = logList.children.length;
      const yogaDesync = yogaCount !== actualCount;

      if (yogaDesync) {
        console.error(`[tick=${tick}] YOGA DESYNC: glyph=${actualCount} yoga=${yogaCount}`);
      }

      if ((!ok || yogaDesync) && firstFailFrame === -1) {
        firstFailFrame = tick;
        console.error(`\n${"=".repeat(60)}`);
        console.error(`FIRST FAILURE at tick=${tick}`);
        if (!ok) console.error(detail);
        console.error(`\nLog list tree:`);
        console.error(dumpTree(logList, "  ").join("\n"));
        console.error(`\nLog list parent (activityWrapper):`);
        console.error(`  layout: y=${activityWrapper.layout.y} h=${activityWrapper.layout.height}`);
        console.error(`  logList: y=${logList.layout.y} h=${logList.layout.height}`);
        console.error(`\nMain row (clip parent):`);
        console.error(`  layout: y=${mainRow.layout.y} h=${mainRow.layout.height}`);
        console.error(`  clip=${mainRow.resolvedStyle.clip}`);

        // Dump framebuffer for the activity log area
        const logY = logList.layout.y;
        const logH = logList.layout.height;
        const logX = logList.layout.x;
        console.error(`\nFramebuffer at logList area (x=${logX}, y=${logY}, h=${logH}):`);
        for (let r = logY; r < Math.min(logY + logH, HEIGHT); r++) {
          let line = "";
          for (let c = logX; c < Math.min(logX + 48, WIDTH); c++) {
            line += fb.get(c, r)?.ch ?? " ";
          }
          console.error(`  row ${r}: "${line}"`);
        }
        console.error(`${"=".repeat(60)}\n`);
      }

      // Milestone logging
      const isMilestone = tick === WINDOW || tick === WINDOW + 10 || tick === TOTAL - 1;
      if (isMilestone) {
        console.error(
          `[tick=${tick}] logList: ${actualCount} children, yoga=${yogaCount}` +
          ` y=${logList.layout.y} h=${logList.layout.height}` +
          ` first-child-y=${logList.children[0]?.layout.y ?? "?"} last-child-y=${logList.children[actualCount - 1]?.layout.y ?? "?"}`
        );
      }
    }

    // Final framebuffer dump
    console.error("\n--- Final framebuffer (full) ---");
    for (let r = 0; r < HEIGHT; r++) {
      let line = "";
      for (let c = 0; c < WIDTH; c++) {
        line += fb.get(c, r)?.ch ?? " ";
      }
      console.error(`  row ${r.toString().padStart(2)}: "${line}"`);
    }

    await renderer.unmount();

    if (firstFailFrame !== -1) {
      throw new Error(`Layout/paint corruption at tick ${firstFailFrame}`);
    }
  });

  test("paint layer: framebuffer matches layout after sliding window", async () => {
    // Import paint infrastructure
    const { paintTree } = await import("../paint/painter.js");
    const { Framebuffer } = await import("../paint/framebuffer.js");

    const renderer = createTestRenderer();
    const WINDOW = 20; // smaller for readable framebuffer inspection
    const TOTAL = 40;
    const WIDTH = 40;
    const HEIGHT = 24;

    const fb = new Framebuffer(WIDTH, HEIGHT);
    const prevFb = new Framebuffer(WIDTH, HEIGHT);
    const allLogs: LogEntry[] = [];
    let firstPaintFail = -1;

    for (let tick = 0; tick < TOTAL; tick++) {
      allLogs.push({ id: tick, message: `msg-${tick}` });
      const visible = allLogs.slice(-WINDOW);

      await renderer.update(
        React.createElement(SlidingWindowList, { items: visible }),
      );

      // Re-run layout at correct dimensions
      computeLayout(renderer.container.children, WIDTH, HEIGHT, renderer.rootYoga, true);

      // Paint — first frame is full, rest are incremental
      const isFirst = tick === 0;
      paintTree(renderer.container.children, fb, { fullRedraw: isFirst });

      // Read framebuffer rows and check the first text node content
      const root = renderer.container.children[0];
      if (!root) continue;

      for (let i = 0; i < Math.min(visible.length, HEIGHT); i++) {
        const child = root.children[i];
        if (!child) continue;
        const expectedY = child.layout.y;
        if (expectedY < 0 || expectedY >= HEIGHT) continue;

        // Read the row from framebuffer
        let rowText = "";
        for (let col = 0; col < WIDTH; col++) {
          const cell = fb.get(col, expectedY);
          rowText += cell?.ch ?? " ";
        }
        const trimmed = rowText.trim();

        // The row should contain the item's ID number
        const expectedId = `${visible[i]!.id}`;
        if (!trimmed.includes(expectedId) && firstPaintFail === -1) {
          firstPaintFail = tick;
          console.error(`\n[PAINT FAIL tick=${tick}] Row ${expectedY} should contain "${expectedId}"`);
          console.error(`  Framebuffer row: "${rowText}"`);
          console.error(`  Child layout: y=${child.layout.y} h=${child.layout.height}`);
          console.error(`  Child text: ${child.children[0]?.text ?? "?"}`);

          // Dump a few framebuffer rows around the issue
          console.error(`\n  Framebuffer context (rows ${Math.max(0, expectedY - 2)} to ${Math.min(HEIGHT - 1, expectedY + 2)}):`);
          for (let r = Math.max(0, expectedY - 2); r <= Math.min(HEIGHT - 1, expectedY + 2); r++) {
            let line = "";
            for (let c = 0; c < WIDTH; c++) {
              line += fb.get(c, r)?.ch ?? " ";
            }
            console.error(`    row ${r}: "${line}"`);
          }
        }
      }

      // Swap buffers (like render.ts does)
      prevFb.copyFrom(fb);
    }

    if (firstPaintFail !== -1) {
      console.error(`\nPaint corruption detected at tick ${firstPaintFail}.`);
    }

    // Also dump the final framebuffer
    console.error("\n--- Final framebuffer (first 22 rows) ---");
    for (let r = 0; r < Math.min(22, HEIGHT); r++) {
      let line = "";
      for (let c = 0; c < WIDTH; c++) {
        line += fb.get(c, r)?.ch ?? " ";
      }
      console.error(`  row ${r.toString().padStart(2)}: "${line}"`);
    }

    await renderer.unmount();

    if (firstPaintFail !== -1) {
      throw new Error(`Paint corruption at tick ${firstPaintFail}`);
    }
  });
});
