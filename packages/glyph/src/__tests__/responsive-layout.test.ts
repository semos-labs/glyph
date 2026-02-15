import { test, expect, describe } from "bun:test";
import { createGlyphNode, appendChild } from "../reconciler/nodes.js";
import { computeLayout } from "../layout/yogaLayout.js";
import type { GlyphNode } from "../reconciler/nodes.js";
import type { Style } from "../types/index.js";

// ── Helpers ────────────────────────────────────────────────────

/** Create a box node with optional children wired up. */
function box(style: Style, children: GlyphNode[] = []): GlyphNode {
  const node = createGlyphNode("box", { style });
  for (const child of children) {
    appendChild(node, child);
  }
  return node;
}

/** Create a text node with measured content. */
function text(content: string, style: Style = {}): GlyphNode {
  const node = createGlyphNode("text", { style });
  node.text = content;
  return node;
}

// ── Tree builders ──────────────────────────────────────────────

/**
 * Build the responsive-layout example's node tree for the given
 * terminal dimensions. Match-gated subtrees are conditionally
 * included just as the React components would render them.
 */
function buildExampleTree(cols: number, _rows: number) {
  const showMetrics = cols >= 80;   // <Match minColumns={80}>
  const showStats = cols >= 120;    // <Match minColumns={120}>
  const showAllEvents = cols >= 80; // useMediaQuery({ minColumns: 80 })

  // ── Header ────────────────────
  const header = box(
    { flexDirection: "row", alignItems: "center", paddingX: 1, bg: { base: undefined, md: "#1a1a2e" } },
    [
      text("◆ ", { bold: true, color: "cyan" }),
      text("infra monitor", { bold: true }),
      text(" · ", { dim: true }),
      text("6/8 healthy", { color: "green" }),
      box({ flexGrow: 1 }), // Spacer
      text(`${cols}×${_rows} [bp]`, { dim: true }),
    ],
  );

  // ── Service cards ─────────────
  function serviceCard(name: string, hasMetrics: boolean): GlyphNode {
    const nameRow = box(
      { flexDirection: "row", gap: 1 },
      [
        text("●", { color: "green" }),
        text(name, { bold: true }),
        box({ flexGrow: 1 }), // Spacer
        text("healthy", { dim: true }),
      ],
    );

    const children = [nameRow];

    if (hasMetrics) {
      const metricsRow = box(
        { flexDirection: "row", gap: 2 },
        [
          box({ flexDirection: "row", gap: 1, flexGrow: 1 }, [
            text("cpu", { dim: true }),
            box({ flexGrow: 1 }, [text("████░░░░░░", {})]),
          ]),
          box({ flexDirection: "row", gap: 1, flexGrow: 1 }, [
            text("mem", { dim: true }),
            box({ flexGrow: 1 }, [text("██████░░░░", {})]),
          ]),
          text("12,847 req/s", { dim: true }),
        ],
      );
      children.push(metricsRow);
    }

    return box(
      {
        flexDirection: "column",
        border: "round",
        borderColor: "green",
        paddingX: 1,
        width: { base: "100%", lg: "50%" },
      },
      children,
    );
  }

  const serviceNames = [
    "api-gateway", "auth-service", "user-service", "payment-svc",
    "email-worker", "search-index", "cdn-proxy", "analytics-db",
  ];
  const cards = serviceNames.map((n) => serviceCard(n, showMetrics));

  const cardsContainer = box(
    {
      flexDirection: { base: "column", lg: "row" },
      flexWrap: { base: "nowrap", lg: "wrap" },
    },
    cards,
  );

  const servicesLabel = box({ paddingX: 1 }, [text("services", { bold: true })]);
  const servicesPanel = box(
    { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0 },
    [servicesLabel, cardsContainer],
  );

  // ── Event log ─────────────────
  const maxEvents = showAllEvents ? 8 : 4;
  const eventRows: GlyphNode[] = [];
  for (let i = 0; i < maxEvents; i++) {
    eventRows.push(
      box({ flexDirection: "row", gap: 1 }, [
        text("14:32", { dim: true }),
        text("Event message text here.", { wrap: "truncate" }),
      ]),
    );
  }

  const eventsLabel = box({ paddingX: 1 }, [text("event log", { bold: true })]);
  const eventsBox = box(
    { flexDirection: "column", border: "round", borderColor: "blackBright", paddingX: 1 },
    eventRows,
  );
  const eventLog = box(
    { flexDirection: "column", width: { base: "100%", md: 32 }, flexShrink: 0 },
    [eventsLabel, eventsBox],
  );

  // ── Content area ──────────────
  const contentArea = box(
    { flexDirection: { base: "column", md: "row" }, flexGrow: 1, clip: true },
    [servicesPanel, eventLog],
  );

  // ── Quick stats (lg+ only) ────
  const quickStats = showStats
    ? box({ flexDirection: "row", gap: 2, paddingX: 1 }, [
        box({ flexDirection: "row", gap: 1 }, [text("total req/s", { dim: true }), text("63,874", { bold: true })]),
        box({ flexDirection: "row", gap: 1 }, [text("avg cpu", { dim: true }), text("32%", { bold: true })]),
        box({ flexDirection: "row", gap: 1 }, [text("avg mem", { dim: true }), text("46%", { bold: true })]),
      ])
    : null;

  // ── Footer ────────────────────
  const footer = box({ paddingX: 1 }, [
    text("q quit · resize the terminal to see responsive layout in action", { dim: true }),
  ]);

  // ── Root ──────────────────────
  const rootChildren = [header];
  if (quickStats) rootChildren.push(quickStats);
  rootChildren.push(contentArea, footer);

  const root = box(
    { flexDirection: "column", width: "100%", height: "100%" },
    rootChildren,
  );

  return { root, servicesPanel, eventLog, contentArea, cards, cardsContainer, header, footer, quickStats };
}

// ── Layout runner ──────────────────────────────────────────────

function layout(cols: number, rows: number) {
  const tree = buildExampleTree(cols, rows);
  computeLayout([tree.root], cols, rows);
  return tree;
}

// ── Assertion helpers ──────────────────────────────────────────

/** Collect horizontal overflow errors (x + width > cols). */
function horizontalOverflows(node: GlyphNode, cols: number, path = "root"): string[] {
  const errors: string[] = [];
  const { x, width } = node.layout;

  if (x + width > cols) {
    errors.push(`${path}: x=${x} + w=${width} = ${x + width} > ${cols} cols`);
  }

  for (let i = 0; i < node.children.length; i++) {
    errors.push(...horizontalOverflows(node.children[i]!, cols, `${path}[${i}]`));
  }
  return errors;
}

/** Collect vertical overflow errors (y + height > rows). */
function verticalOverflows(node: GlyphNode, rows: number, path = "root"): string[] {
  const errors: string[] = [];
  const { y, height } = node.layout;

  if (y + height > rows) {
    errors.push(`${path}: y=${y} + h=${height} = ${y + height} > ${rows} rows`);
  }

  for (let i = 0; i < node.children.length; i++) {
    errors.push(...verticalOverflows(node.children[i]!, rows, `${path}[${i}]`));
  }
  return errors;
}

// ── Tests ──────────────────────────────────────────────────────

const ALL_SIZES: [number, number, string][] = [
  [40, 24, "sm (40×24)"],
  [60, 24, "sm-wide (60×24)"],
  [80, 24, "md (80×24)"],
  [100, 24, "md-wide (100×24)"],
  [120, 24, "lg (120×24)"],
  [120, 30, "lg-tall (120×30)"],
  [160, 24, "xl (160×24)"],
  [160, 25, "xl (160×25)"],
  [175, 25, "xl-wide (175×25)"],
  [182, 24, "xl-wide (182×24)"],
  [200, 30, "xxl (200×30)"],
];

describe("responsive layout — no horizontal overflow", () => {
  for (const [cols, rows, label] of ALL_SIZES) {
    test(`${label}`, () => {
      const tree = layout(cols, rows);
      const errors = horizontalOverflows(tree.root, cols);
      expect(errors).toEqual([]);
    });
  }
});

describe("responsive layout — no vertical overflow at lg+", () => {
  const lgSizes = ALL_SIZES.filter(([cols]) => cols >= 120);
  for (const [cols, rows, label] of lgSizes) {
    test(`${label}`, () => {
      const tree = layout(cols, rows);
      const errors = verticalOverflows(tree.root, rows);
      expect(errors).toEqual([]);
    });
  }
});

describe("responsive layout — root fills screen", () => {
  test("root fills at xl", () => {
    const { root } = layout(160, 24);
    expect(root.layout.width).toBe(160);
    expect(root.layout.height).toBe(24);
  });

  test("root fills at narrow", () => {
    const { root } = layout(40, 20);
    expect(root.layout.width).toBe(40);
    expect(root.layout.height).toBe(20);
  });
});

describe("responsive layout — event log sidebar", () => {
  test("at md (100 cols): event log is 32 cols wide sidebar", () => {
    const { eventLog } = layout(100, 24);
    expect(eventLog.layout.width).toBe(32);
    expect(eventLog.layout.x + eventLog.layout.width).toBeLessThanOrEqual(100);
    expect(eventLog.layout.x).toBeGreaterThan(0);
  });

  test("at lg (120 cols): event log + services don't overlap", () => {
    const { eventLog, servicesPanel } = layout(120, 24);
    expect(eventLog.layout.width).toBe(32);
    expect(eventLog.layout.x + eventLog.layout.width).toBeLessThanOrEqual(120);
    expect(servicesPanel.layout.x + servicesPanel.layout.width).toBeLessThanOrEqual(eventLog.layout.x);
  });

  test("at xl (160 cols): services = 128, event log = 32", () => {
    const { eventLog, servicesPanel } = layout(160, 24);
    expect(eventLog.layout.width).toBe(32);
    expect(servicesPanel.layout.width).toBe(128);
  });

  test("at 182 cols: services = 150, event log = 32", () => {
    const { eventLog, servicesPanel } = layout(182, 24);
    expect(eventLog.layout.width).toBe(32);
    expect(servicesPanel.layout.width).toBe(150);
    expect(eventLog.layout.x).toBe(150);
  });

  test("at narrow (40 cols): event log is full-width, below services", () => {
    const { eventLog, servicesPanel } = layout(40, 80);
    expect(eventLog.layout.width).toBe(40);
    expect(eventLog.layout.y).toBeGreaterThanOrEqual(
      servicesPanel.layout.y + servicesPanel.layout.height,
    );
  });
});

describe("responsive layout — service cards", () => {
  test("at lg (120 cols): cards in 2-column grid (50% width each)", () => {
    const { cards, servicesPanel } = layout(120, 30);
    const panelInnerWidth = servicesPanel.layout.innerWidth;
    const expectedCardWidth = Math.floor(panelInnerWidth / 2);

    const card0 = cards[0]!;
    const card1 = cards[1]!;
    expect(card0.layout.y).toBe(card1.layout.y); // same row
    expect(card0.layout.width).toBeCloseTo(expectedCardWidth, -1);
    expect(card1.layout.width).toBeCloseTo(expectedCardWidth, -1);
  });

  test("at md (80 cols): cards stacked vertically", () => {
    const { cards } = layout(80, 40);
    const card0 = cards[0]!;
    const card1 = cards[1]!;
    expect(card1.layout.y).toBeGreaterThan(card0.layout.y);
  });

  test("at narrow (40 cols): cards are 100% width", () => {
    const { cards } = layout(40, 80);
    expect(cards[0]!.layout.width).toBe(40);
  });

  test("at xl (160 cols): all 8 cards fit within services panel horizontally", () => {
    const { cards, servicesPanel } = layout(160, 24);
    const rightEdge = servicesPanel.layout.x + servicesPanel.layout.width;
    for (const card of cards) {
      expect(card.layout.x + card.layout.width).toBeLessThanOrEqual(rightEdge);
    }
  });
});

describe("responsive layout — content area direction", () => {
  test("at md+ (100 cols): services and event log side by side", () => {
    const { servicesPanel, eventLog } = layout(100, 24);
    expect(servicesPanel.layout.y).toBe(eventLog.layout.y);
    expect(eventLog.layout.x).toBeGreaterThan(servicesPanel.layout.x);
  });

  test("at narrow (40 cols): services and event log stacked vertically", () => {
    const { servicesPanel, eventLog } = layout(40, 80);
    expect(eventLog.layout.y).toBeGreaterThan(servicesPanel.layout.y);
    expect(servicesPanel.layout.x).toBe(0);
    expect(eventLog.layout.x).toBe(0);
  });
});

describe("responsive layout — header and footer", () => {
  test("header at top, full width", () => {
    const { header } = layout(100, 24);
    expect(header.layout.y).toBe(0);
    expect(header.layout.width).toBe(100);
  });

  test("footer full width, below content area", () => {
    const { footer, contentArea } = layout(160, 24);
    expect(footer.layout.width).toBe(160);
    expect(footer.layout.y).toBeGreaterThanOrEqual(
      contentArea.layout.y + contentArea.layout.height,
    );
  });

  test("at lg+: footer is within screen bounds", () => {
    const { footer } = layout(160, 24);
    expect(footer.layout.y + footer.layout.height).toBeLessThanOrEqual(24);
  });
});

describe("responsive layout — quick stats", () => {
  test("visible at lg+ (120 cols)", () => {
    const { quickStats } = layout(120, 24);
    expect(quickStats).not.toBeNull();
    expect(quickStats!.layout.height).toBeGreaterThan(0);
    expect(quickStats!.layout.width).toBe(120);
  });

  test("hidden at md (100 cols)", () => {
    const { quickStats } = layout(100, 24);
    expect(quickStats).toBeNull();
  });
});

// ── Resize tests ───────────────────────────────────────────────

/** Capture a flat snapshot of every node's layout rect for deep comparison. */
function captureAllLayouts(
  node: GlyphNode,
): { x: number; y: number; width: number; height: number }[] {
  const out: { x: number; y: number; width: number; height: number }[] = [];
  (function walk(n: GlyphNode) {
    out.push({
      x: n.layout.x,
      y: n.layout.y,
      width: n.layout.width,
      height: n.layout.height,
    });
    for (const c of n.children) walk(c);
  })(node);
  return out;
}

describe("screen resize — transitions (fresh tree per size)", () => {
  const RESIZE_PAIRS: [number, number, number, number, string][] = [
    [160, 24, 40, 24, "xl → sm (large shrink)"],
    [40, 24, 160, 24, "sm → xl (large grow)"],
    [80, 24, 120, 24, "md → lg (cross breakpoint up)"],
    [120, 24, 80, 24, "lg → md (cross breakpoint down)"],
    [119, 24, 120, 24, "just below lg → exactly lg"],
    [79, 24, 80, 24, "just below md → exactly md"],
    [120, 24, 121, 24, "lg → lg+1 (within breakpoint)"],
    [100, 24, 100, 30, "same width, taller"],
    [100, 30, 100, 24, "same width, shorter"],
  ];

  for (const [fromCols, fromRows, toCols, toRows, label] of RESIZE_PAIRS) {
    test(`${label}: no horizontal overflow after resize`, () => {
      // Render at the "from" size first (establishes prior state)
      layout(fromCols, fromRows);

      // Rebuild fresh tree for the "to" size and compute layout
      const after = layout(toCols, toRows);

      expect(horizontalOverflows(after.root, toCols)).toEqual([]);
      expect(after.root.layout.width).toBe(toCols);
      expect(after.root.layout.height).toBe(toRows);
    });
  }
});

describe("screen resize — stale tree safety (pre-React-reconcile)", () => {
  // These tests simulate the race condition: the terminal has resized,
  // responsive style values are re-resolved for the new dimensions, but
  // React has NOT yet re-rendered — so <Match>-gated subtrees and
  // useMediaQuery-driven logic still reflect the OLD size.

  test("xl tree re-laid-out at sm: no crash, root fills screen", () => {
    const tree = buildExampleTree(160, 24);
    computeLayout([tree.root], 160, 24);

    // Simulate resize without rebuilding tree
    computeLayout([tree.root], 40, 24);

    expect(tree.root.layout.width).toBe(40);
    expect(tree.root.layout.height).toBe(24);
  });

  test("sm tree re-laid-out at xl: no crash, root fills screen", () => {
    const tree = buildExampleTree(40, 24);
    computeLayout([tree.root], 40, 24);

    computeLayout([tree.root], 160, 24);

    expect(tree.root.layout.width).toBe(160);
    expect(tree.root.layout.height).toBe(24);
  });

  test("lg tree re-laid-out at sm: no crash, root fills screen", () => {
    const tree = buildExampleTree(120, 24);
    computeLayout([tree.root], 120, 24);

    computeLayout([tree.root], 40, 24);

    expect(tree.root.layout.width).toBe(40);
    expect(tree.root.layout.height).toBe(24);
  });

  test("stale xl→sm overflow is fixed after fresh rebuild", () => {
    // Build xl tree (includes QuickStats, metrics rows)
    const xlTree = buildExampleTree(160, 24);
    computeLayout([xlTree.root], 160, 24);

    // Stale layout at sm — may have overflow from xl-only subtrees
    // (e.g. QuickStats row, metrics rows that are wider than 40 cols)
    computeLayout([xlTree.root], 40, 24);
    const staleErrors = horizontalOverflows(xlTree.root, 40);
    // Overflow here is expected — it's the race condition

    // Fresh rebuild at sm eliminates the overflow
    const smTree = buildExampleTree(40, 24);
    computeLayout([smTree.root], 40, 24);
    expect(horizontalOverflows(smTree.root, 40)).toEqual([]);

    // Verify the stale state *did* have overflow (if it doesn't, that's
    // even better, but we don't rely on it)
    if (staleErrors.length === 0) {
      // Great — responsive styles alone handled it
    }
  });

  test("stale sm→xl: missing nodes don't cause layout to crash", () => {
    // sm tree has NO QuickStats and fewer events
    const smTree = buildExampleTree(40, 24);
    computeLayout([smTree.root], 40, 24);
    expect(smTree.quickStats).toBeNull();

    // Re-layout at xl — QuickStats is still null, but layout shouldn't crash
    computeLayout([smTree.root], 160, 24);

    expect(smTree.root.layout.width).toBe(160);
    // Event log should pick up responsive width: 32 (md breakpoint applies)
    expect(smTree.eventLog.layout.width).toBe(32);
    // Services panel should fill the rest
    expect(smTree.servicesPanel.layout.width).toBe(128);
  });

  test("rapid resize sequence on same tree does not crash", () => {
    const tree = buildExampleTree(120, 24);

    // Simulate rapid consecutive resizes without rebuilding
    const sizes: [number, number][] = [
      [120, 24],
      [40, 20],
      [160, 25],
      [80, 24],
      [200, 30],
      [60, 24],
      [120, 24],
    ];

    for (const [cols, rows] of sizes) {
      computeLayout([tree.root], cols, rows);
      expect(tree.root.layout.width).toBe(cols);
      expect(tree.root.layout.height).toBe(rows);
    }
  });
});

describe("screen resize — breakpoint boundaries", () => {
  test("79 → 80 cols: content area switches from column to row", () => {
    const before = layout(79, 24);
    // At 79 (below md): services and event log stacked vertically
    expect(before.eventLog.layout.x).toBe(before.servicesPanel.layout.x);
    expect(before.eventLog.layout.y).toBeGreaterThan(before.servicesPanel.layout.y);

    const after = layout(80, 24);
    // At 80 (md): services and event log side by side
    expect(after.eventLog.layout.x).toBeGreaterThan(after.servicesPanel.layout.x);
  });

  test("79 → 80 cols: event log changes from full-width to 32-col sidebar", () => {
    const before = layout(79, 80);
    expect(before.eventLog.layout.width).toBe(79);

    const after = layout(80, 24);
    expect(after.eventLog.layout.width).toBe(32);
  });

  test("79 → 80 cols: service card metrics appear", () => {
    const before = buildExampleTree(79, 30);
    computeLayout([before.root], 79, 30);
    // At 79: no metrics rows → card has 1 child (name row only)
    const cardChildren79 = before.cards[0]!.children.length;

    const after = buildExampleTree(80, 30);
    computeLayout([after.root], 80, 30);
    // At 80: metrics row added → card has 2 children
    const cardChildren80 = after.cards[0]!.children.length;

    expect(cardChildren80).toBeGreaterThan(cardChildren79);
  });

  test("119 → 120 cols: QuickStats appears", () => {
    const before = layout(119, 24);
    expect(before.quickStats).toBeNull();

    const after = layout(120, 24);
    expect(after.quickStats).not.toBeNull();
    expect(after.quickStats!.layout.height).toBeGreaterThan(0);
  });

  test("119 → 120 cols: cards switch from stacked to 2-column grid", () => {
    const before = layout(119, 30);
    const card0b = before.cards[0]!;
    const card1b = before.cards[1]!;
    expect(card1b.layout.y).toBeGreaterThan(card0b.layout.y); // stacked

    const after = layout(120, 30);
    const card0a = after.cards[0]!;
    const card1a = after.cards[1]!;
    expect(card0a.layout.y).toBe(card1a.layout.y); // same row
  });
});

describe("screen resize — idempotency & round-trips", () => {
  test("computing layout twice at the same size yields identical results", () => {
    const tree = buildExampleTree(120, 24);

    computeLayout([tree.root], 120, 24);
    const first = captureAllLayouts(tree.root);

    computeLayout([tree.root], 120, 24);
    const second = captureAllLayouts(tree.root);

    expect(first).toEqual(second);
  });

  test("A → B → A round-trip produces identical layout", () => {
    // First render at A
    const treeA1 = buildExampleTree(120, 24);
    computeLayout([treeA1.root], 120, 24);
    const layoutA1 = captureAllLayouts(treeA1.root);

    // Render at B
    layout(80, 24);

    // Back to A (fresh tree, same dimensions)
    const treeA2 = buildExampleTree(120, 24);
    computeLayout([treeA2.root], 120, 24);
    const layoutA2 = captureAllLayouts(treeA2.root);

    expect(layoutA1).toEqual(layoutA2);
  });

  test("A → B → C → A round-trip through multiple sizes", () => {
    const treeA = buildExampleTree(160, 24);
    computeLayout([treeA.root], 160, 24);
    const layoutA = captureAllLayouts(treeA.root);

    layout(40, 24);
    layout(80, 30);

    const treeA2 = buildExampleTree(160, 24);
    computeLayout([treeA2.root], 160, 24);
    const layoutA2 = captureAllLayouts(treeA2.root);

    expect(layoutA).toEqual(layoutA2);
  });
});
