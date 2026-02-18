/**
 * Tests for the persistent Yoga tree (Phase 4) with dynamic state changes.
 * Verifies that layout remains correct when text content changes between frames.
 */
import { describe, test, expect } from "bun:test";
import Yoga, { FlexDirection, Direction } from "yoga-layout";
import type { Node as YogaNode } from "yoga-layout";
import {
  createGlyphNode,
  appendChild,
  appendTextChild,
  removeChild,
  freeYogaNode,
} from "../reconciler/nodes.js";
import type {
  GlyphNode,
  GlyphTextInstance,
} from "../reconciler/nodes.js";
import { computeLayout, createRootYogaNode } from "../layout/yogaLayout.js";
import type { Style } from "../types/index.js";

function makeNode(type: "box" | "text", style: Style = {}): GlyphNode {
  return createGlyphNode(type, { style });
}

function makeText(text: string, style: Style = {}): { node: GlyphNode; raw: GlyphTextInstance } {
  const node = createGlyphNode("text", { style });
  const raw: GlyphTextInstance = { type: "raw-text", text, parent: null };
  appendTextChild(node, raw);
  return { node, raw };
}

function layout(roots: GlyphNode[], w: number, h: number, rootYoga: YogaNode) {
  computeLayout(roots, w, h, rootYoga);
}

describe("persistent Yoga tree — dynamic content", () => {
  test("column layout: two text rows have distinct Y positions", () => {
    const rootYoga = createRootYogaNode();

    const col = makeNode("box", { flexDirection: "column", width: "100%", height: "100%" });
    const { node: t1 } = makeText("Hello", {});
    const { node: t2 } = makeText("World", {});
    appendChild(col, t1);
    appendChild(col, t2);

    // Attach to root
    rootYoga.insertChild(col.yogaNode!, 0);

    layout([col], 80, 24, rootYoga);

    console.log("t1 layout:", t1.layout);
    console.log("t2 layout:", t2.layout);

    expect(t1.layout.y).toBe(0);
    expect(t2.layout.y).toBe(1); // Second text should be on row 1
    expect(t1.layout.height).toBe(1);
    expect(t2.layout.height).toBe(1);

    rootYoga.freeRecursive();
  });

  test("column with row children: rows at different Y positions", () => {
    const rootYoga = createRootYogaNode();

    // Mimic FrameHUD structure
    const hud = makeNode("box", { flexDirection: "column" });

    // Summary row
    const summary = makeNode("box", { flexDirection: "row", gap: 1 });
    const { node: st1 } = makeText("6.96ms", { bold: true });
    const { node: st2 } = makeText("│", { dim: true });
    const { node: st3 } = makeText("avg 13ms", {});
    appendChild(summary, st1);
    appendChild(summary, st2);
    appendChild(summary, st3);

    // Phase row
    const phase = makeNode("box", { flexDirection: "row", gap: 2 });
    const { node: pt1 } = makeText("layout", { dim: true, width: 7 });
    const { node: pt2 } = makeText("6.96ms", { width: 8 });
    const { node: pt3 } = makeText("(52%)", { dim: true });
    appendChild(phase, pt1);
    appendChild(phase, pt2);
    appendChild(phase, pt3);

    appendChild(hud, summary);
    appendChild(hud, phase);

    // Wrap in root
    const root = makeNode("box", { flexDirection: "column", width: "100%", height: "100%" });
    appendChild(root, hud);
    rootYoga.insertChild(root.yogaNode!, 0);

    layout([root], 80, 24, rootYoga);

    console.log("summary layout:", summary.layout);
    console.log("phase layout:", phase.layout);
    console.log("st1 layout:", st1.layout);
    console.log("pt1 layout:", pt1.layout);

    // Summary and phase should be on different rows
    expect(summary.layout.y).toBe(0);
    expect(summary.layout.height).toBeGreaterThanOrEqual(1);
    expect(phase.layout.y).toBeGreaterThanOrEqual(1);
    expect(phase.layout.y).toBeGreaterThan(summary.layout.y);

    rootYoga.freeRecursive();
  });

  test("text update + markDirty preserves column layout", () => {
    const rootYoga = createRootYogaNode();

    const col = makeNode("box", { flexDirection: "column", width: "100%", height: "100%" });
    const { node: t1, raw: r1 } = makeText("Short", {});
    const { node: t2, raw: r2 } = makeText("World", {});
    appendChild(col, t1);
    appendChild(col, t2);
    rootYoga.insertChild(col.yogaNode!, 0);

    // Frame 1
    layout([col], 80, 24, rootYoga);
    expect(t1.layout.y).toBe(0);
    expect(t2.layout.y).toBe(1);

    // Simulate commitTextUpdate: change text content
    r1.text = "A much longer text that wraps maybe";
    t1.text = r1.text;
    t1.yogaNode!.markDirty();

    // Frame 2
    layout([col], 80, 24, rootYoga);

    console.log("After update — t1:", t1.layout);
    console.log("After update — t2:", t2.layout);

    // t1 should still be at y=0, t2 should be below t1
    expect(t1.layout.y).toBe(0);
    expect(t2.layout.y).toBeGreaterThanOrEqual(1);
    expect(t2.layout.y).toBeGreaterThan(t1.layout.y);
  });

  test("style re-application does not break layout", () => {
    const rootYoga = createRootYogaNode();

    const col = makeNode("box", { flexDirection: "column", width: "100%", height: "100%" });
    const { node: t1 } = makeText("Hello", {});
    const { node: t2 } = makeText("World", {});
    appendChild(col, t1);
    appendChild(col, t2);
    rootYoga.insertChild(col.yogaNode!, 0);

    // Frame 1
    layout([col], 80, 24, rootYoga);
    const y1_frame1 = t1.layout.y;
    const y2_frame1 = t2.layout.y;

    // Simulate commitUpdate: change style reference (same values, new object)
    col.style = { flexDirection: "column", width: "100%", height: "100%" };
    col._lastStyleRef = null; // Force re-resolve
    t1.style = {};
    t1._lastStyleRef = null;
    t2.style = {};
    t2._lastStyleRef = null;

    // Frame 2
    layout([col], 80, 24, rootYoga);

    console.log("After style re-apply — t1:", t1.layout);
    console.log("After style re-apply — t2:", t2.layout);

    expect(t1.layout.y).toBe(y1_frame1);
    expect(t2.layout.y).toBe(y2_frame1);

    rootYoga.freeRecursive();
  });

  test("deleting a Box with children (top-down) does not corrupt Yoga heap", () => {
    const rootYoga = createRootYogaNode();

    // Build a tree: column > [row1(Box>2 Texts), row2(Box>2 Texts)]
    const col = makeNode("box", { flexDirection: "column", width: "100%", height: "100%" });

    const row1 = makeNode("box", { flexDirection: "row" });
    const { node: r1t1 } = makeText("Row1-A", {});
    const { node: r1t2 } = makeText("Row1-B", {});
    appendChild(row1, r1t1);
    appendChild(row1, r1t2);

    const row2 = makeNode("box", { flexDirection: "row" });
    const { node: r2t1 } = makeText("Row2-A", {});
    const { node: r2t2 } = makeText("Row2-B", {});
    appendChild(row2, r2t1);
    appendChild(row2, r2t2);

    appendChild(col, row1);
    appendChild(col, row2);
    rootYoga.insertChild(col.yogaNode!, 0);

    // Frame 1: everything lays out correctly
    layout([col], 80, 24, rootYoga);
    expect(row1.layout.y).toBe(0);
    expect(row2.layout.y).toBe(1);

    // Simulate React deleting row1 subtree (top-down order):
    // 1. removeChild detaches row1 from col (GlyphNode + Yoga)
    removeChild(col, row1);
    // 2. detachDeletedInstance called top-down: parent (row1) before children
    freeYogaNode(row1);   // Parent freed first — must not corrupt heap
    freeYogaNode(r1t1);   // Child freed after — must not use-after-free
    freeYogaNode(r1t2);   // Child freed after — must not use-after-free

    // Frame 2: remaining layout must still be correct (no heap corruption)
    layout([col], 80, 24, rootYoga);
    expect(row2.layout.y).toBe(0); // row2 should now be at top
    expect(row2.layout.height).toBe(1);

    // Verify Yoga nodes are properly nullified
    expect(row1.yogaNode).toBeNull();
    expect(r1t1.yogaNode).toBeNull();
    expect(r1t2.yogaNode).toBeNull();

    rootYoga.freeRecursive();
  });

  test("repeated add/remove cycles don't corrupt layout", () => {
    const rootYoga = createRootYogaNode();

    const col = makeNode("box", { flexDirection: "column", width: "100%", height: "100%" });
    rootYoga.insertChild(col.yogaNode!, 0);

    // Simulate 50 rapid add-then-remove cycles (like log trimming)
    for (let i = 0; i < 50; i++) {
      const row = makeNode("box", { flexDirection: "row" });
      const { node: t1 } = makeText(`Entry-${i}`, {});
      appendChild(row, t1);
      appendChild(col, row);

      // Compute layout with the new row
      layout([col], 80, 24, rootYoga);

      // Remove the row (simulating log trim)
      removeChild(col, row);
      freeYogaNode(row);
      freeYogaNode(t1);
    }

    // After all cycles, add a final row and verify layout is sane
    const finalRow = makeNode("box", { flexDirection: "row" });
    const { node: ft } = makeText("Final", {});
    appendChild(finalRow, ft);
    appendChild(col, finalRow);

    layout([col], 80, 24, rootYoga);
    expect(finalRow.layout.y).toBe(0);
    expect(finalRow.layout.height).toBe(1);
    expect(ft.layout.width).toBeGreaterThan(0);

    rootYoga.freeRecursive();
  });

  test("sliding window: delete from start + add to end (unique-key pattern)", () => {
    // This is the exact pattern that triggers the bug when using
    // key={log.id} in a list that trims old entries via slice(-N).
    // React deletes old nodes from the start and creates new ones at the end.
    const rootYoga = createRootYogaNode();

    const WINDOW = 10; // keep 10 items visible
    const TOTAL = 60; // add 60 items total

    const col = makeNode("box", { flexDirection: "column", width: 80, height: 24 });
    rootYoga.insertChild(col.yogaNode!, 0);

    // Track live rows by their "key" (id)
    const liveRows = new Map<number, { row: GlyphNode; t1: GlyphNode; t2: GlyphNode }>();

    for (let id = 0; id < TOTAL; id++) {
      // Create a new row (simulates createInstance + appendInitialChild)
      const row = makeNode("box", { flexDirection: "row", gap: 1 });
      const { node: t1 } = makeText(`${id}`, { width: 4 });
      const { node: t2 } = makeText(`Message-${id}`, {});
      appendChild(row, t1);
      appendChild(row, t2);

      // Append to parent (simulates commitPlacement → appendChild)
      appendChild(col, row);
      liveRows.set(id, { row, t1, t2 });

      // Trim: remove oldest if over window size
      // (simulates React reconciling after slice(-WINDOW))
      if (liveRows.size > WINDOW) {
        const oldestId = id - WINDOW;
        const old = liveRows.get(oldestId)!;
        // removeChild detaches from Yoga tree + frees subtree synchronously
        removeChild(col, old.row);
        // detachDeletedInstance would call freeYogaNode — now a no-op
        freeYogaNode(old.row);
        freeYogaNode(old.t1);
        freeYogaNode(old.t2);
        liveRows.delete(oldestId);
      }

      // Compute layout every frame
      layout([col], 80, 24, rootYoga);

      // Verify: first live row should be at y=0, subsequent rows at y=1,2,...
      const ids = [...liveRows.keys()].sort((a, b) => a - b);
      for (let j = 0; j < ids.length; j++) {
        const entry = liveRows.get(ids[j]!)!;
        expect(entry.row.layout.y).toBe(j);
        expect(entry.row.layout.height).toBe(1);
      }

      // Also verify parent Yoga child count matches GlyphNode child count
      expect(col.yogaNode!.getChildCount()).toBe(col.children.length);
    }

    rootYoga.freeRecursive();
  });
});
