import { describe, test, expect } from "bun:test";
import {
  createGlyphNode,
  appendChild,
  removeChild,
  generateFocusId,
} from "../reconciler/nodes";

describe("createGlyphNode", () => {
  test("creates a box node", () => {
    const node = createGlyphNode("box", {});
    expect(node.type).toBe("box");
    expect(node.children).toEqual([]);
    expect(node.parent).toBeNull();
    expect(node.yogaNode).toBeDefined();
  });

  test("creates a text node", () => {
    const node = createGlyphNode("text", {});
    expect(node.type).toBe("text");
    expect(node.children).toEqual([]);
  });

  test("creates a node with style", () => {
    const node = createGlyphNode("box", {
      style: {
        width: 10,
        height: 5,
        padding: 1,
      },
    });
    expect(node.style.width).toBe(10);
    expect(node.style.height).toBe(5);
    expect(node.style.padding).toBe(1);
  });

  test("generates unique focusId for focusable nodes", () => {
    const node1 = createGlyphNode("box", { focusable: true });
    const node2 = createGlyphNode("box", { focusable: true });

    expect(node1.focusId).toBeDefined();
    expect(node2.focusId).toBeDefined();
    expect(node1.focusId).not.toBe(node2.focusId);
  });

  test("non-focusable nodes have null focusId", () => {
    const node = createGlyphNode("box", { focusable: false });
    expect(node.focusId).toBeNull();
  });
});

describe("generateFocusId", () => {
  test("generates unique IDs", () => {
    const id1 = generateFocusId();
    const id2 = generateFocusId();
    const id3 = generateFocusId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  test("IDs are strings", () => {
    const id = generateFocusId();
    expect(typeof id).toBe("string");
  });
});

describe("appendChild", () => {
  test("adds child to parent", () => {
    const parent = createGlyphNode("box", {});
    const child = createGlyphNode("text", {});

    appendChild(parent, child);

    expect(parent.children).toContain(child);
    expect(child.parent).toBe(parent);
  });

  test("adds multiple children", () => {
    const parent = createGlyphNode("box", {});
    const child1 = createGlyphNode("text", {});
    const child2 = createGlyphNode("text", {});

    appendChild(parent, child1);
    appendChild(parent, child2);

    expect(parent.children.length).toBe(2);
    expect(parent.children[0]).toBe(child1);
    expect(parent.children[1]).toBe(child2);
  });
});

describe("removeChild", () => {
  test("removes child from parent", () => {
    const parent = createGlyphNode("box", {});
    const child = createGlyphNode("text", {});

    appendChild(parent, child);
    expect(parent.children.length).toBe(1);

    removeChild(parent, child);
    expect(parent.children.length).toBe(0);
    expect(child.parent).toBeNull();
  });
});

describe("node hierarchy", () => {
  test("nested children maintain hierarchy", () => {
    const root = createGlyphNode("box", {});
    const middle = createGlyphNode("box", {});
    const leaf = createGlyphNode("text", {});

    appendChild(root, middle);
    appendChild(middle, leaf);

    expect(root.children[0]).toBe(middle);
    expect(middle.children[0]).toBe(leaf);
    expect(leaf.parent?.parent).toBe(root);
  });
});

describe("node properties", () => {
  test("textContent can be set on text nodes", () => {
    const node = createGlyphNode("text", {});
    node.textContent = "Hello, World!";
    expect(node.textContent).toBe("Hello, World!");
  });

  test("layout properties initialized to zero", () => {
    const node = createGlyphNode("box", {});
    expect(node.layout).toBeDefined();
    expect(node.layout.x).toBe(0);
    expect(node.layout.y).toBe(0);
    expect(node.layout.width).toBe(0);
    expect(node.layout.height).toBe(0);
  });
});
