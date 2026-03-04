import type { GlyphNode } from "../reconciler/nodes.js";

export interface HitTestEntry {
  node: GlyphNode;
  clip: { x: number; y: number; width: number; height: number };
  zIndex: number;
}

export interface HitTestResult {
  node: GlyphNode;
  zIndex: number;
}

/**
 * Find the topmost node at screen position (x, y).
 *
 * Iterates entries in reverse (highest z-index last in sorted array = topmost).
 * Checks that (x, y) is within both the node's layout rect and its clip rect.
 */
export function hitTest(
  entries: HitTestEntry[],
  x: number,
  y: number,
): HitTestResult | null {
  // entries are sorted by zIndex ascending, so reverse-iterate for topmost first
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    const { node, clip } = entry;
    const layout = node.layout;

    // Skip zero-size nodes
    if (layout.width <= 0 || layout.height <= 0) continue;

    // Check clip rect
    if (
      x < clip.x || x >= clip.x + clip.width ||
      y < clip.y || y >= clip.y + clip.height
    ) continue;

    // Check node layout rect
    if (
      x >= layout.x && x < layout.x + layout.width &&
      y >= layout.y && y < layout.y + layout.height
    ) {
      return { node, zIndex: entry.zIndex };
    }
  }

  return null;
}
