import { test, expect, describe } from "bun:test";
import { resolveResponsiveValue, defaultBreakpoints } from "../layout/responsive.js";
import { resolveStyle } from "../layout/responsive.js";
import type { Style } from "../types/index.js";

describe("defaultBreakpoints", () => {
  test("has expected breakpoint thresholds", () => {
    expect(defaultBreakpoints.base).toBe(0);
    expect(defaultBreakpoints.sm).toBe(40);
    expect(defaultBreakpoints.md).toBe(80);
    expect(defaultBreakpoints.lg).toBe(120);
    expect(defaultBreakpoints.xl).toBe(160);
  });
});

describe("resolveResponsiveValue", () => {
  test("passes through plain numbers", () => {
    expect(resolveResponsiveValue(42, 100)).toBe(42);
  });

  test("passes through plain strings", () => {
    expect(resolveResponsiveValue("row", 100)).toBe("row");
  });

  test("passes through plain booleans", () => {
    expect(resolveResponsiveValue(true, 100)).toBe(true);
  });

  test("passes through RGBColor objects (no breakpoint keys)", () => {
    const rgb = { r: 255, g: 0, b: 0 };
    expect(resolveResponsiveValue(rgb, 100)).toBe(rgb);
  });

  test("resolves base breakpoint for narrow terminals", () => {
    expect(resolveResponsiveValue({ base: "column", md: "row" }, 30)).toBe("column");
  });

  test("resolves md breakpoint at exactly 80 columns", () => {
    expect(resolveResponsiveValue({ base: "column", md: "row" }, 80)).toBe("row");
  });

  test("resolves md breakpoint above 80 columns", () => {
    expect(resolveResponsiveValue({ base: "column", md: "row" }, 120)).toBe("row");
  });

  test("picks the largest matching breakpoint (mobile-first)", () => {
    const value = { base: 0, sm: 1, md: 2, lg: 3, xl: 4 };
    expect(resolveResponsiveValue(value, 0)).toBe(0);
    expect(resolveResponsiveValue(value, 39)).toBe(0);
    expect(resolveResponsiveValue(value, 40)).toBe(1);
    expect(resolveResponsiveValue(value, 79)).toBe(1);
    expect(resolveResponsiveValue(value, 80)).toBe(2);
    expect(resolveResponsiveValue(value, 119)).toBe(2);
    expect(resolveResponsiveValue(value, 120)).toBe(3);
    expect(resolveResponsiveValue(value, 159)).toBe(3);
    expect(resolveResponsiveValue(value, 160)).toBe(4);
    expect(resolveResponsiveValue(value, 300)).toBe(4);
  });

  test("skips unset breakpoints", () => {
    expect(resolveResponsiveValue({ base: "a", lg: "b" }, 80)).toBe("a");
    expect(resolveResponsiveValue({ base: "a", lg: "b" }, 120)).toBe("b");
  });

  test("works without base (starts from first matching)", () => {
    expect(resolveResponsiveValue({ md: "row" }, 30)).toBeUndefined();
    expect(resolveResponsiveValue({ md: "row" }, 80)).toBe("row");
  });
});

describe("resolveStyle", () => {
  test("passes through a plain style object unchanged", () => {
    const style: Style = {
      padding: 1,
      flexDirection: "row",
      bg: "red",
    };
    const resolved = resolveStyle(style, 100, 40);
    expect(resolved.padding).toBe(1);
    expect(resolved.flexDirection).toBe("row");
    expect(resolved.bg).toBe("red");
  });

  test("resolves responsive values based on column width", () => {
    const style: Style = {
      flexDirection: { base: "column", md: "row" },
      padding: { base: 0, sm: 1, lg: 2 },
      bg: "blue",
    };

    const narrow = resolveStyle(style, 30, 24);
    expect(narrow.flexDirection).toBe("column");
    expect(narrow.padding).toBe(0);
    expect(narrow.bg).toBe("blue");

    const medium = resolveStyle(style, 80, 24);
    expect(medium.flexDirection).toBe("row");
    expect(medium.padding).toBe(1);

    const wide = resolveStyle(style, 130, 24);
    expect(wide.flexDirection).toBe("row");
    expect(wide.padding).toBe(2);
  });

  test("handles RGBColor correctly (not treated as responsive)", () => {
    const style: Style = {
      bg: { r: 255, g: 0, b: 0 },
      color: { r: 0, g: 255, b: 0 },
    };
    const resolved = resolveStyle(style, 100, 40);
    expect(resolved.bg).toEqual({ r: 255, g: 0, b: 0 });
    expect(resolved.color).toEqual({ r: 0, g: 255, b: 0 });
  });

  test("handles responsive Color values", () => {
    const style: Style = {
      bg: { base: "red", md: "blue" },
    };
    expect(resolveStyle(style, 30, 24).bg).toBe("red");
    expect(resolveStyle(style, 80, 24).bg).toBe("blue");
  });

  test("handles mixed plain and responsive values", () => {
    const style: Style = {
      padding: 1,
      flexDirection: { base: "column", md: "row" },
      bg: "#ff0000",
      gap: { base: 0, lg: 2 },
    };
    const resolved = resolveStyle(style, 100, 40);
    expect(resolved.padding).toBe(1);
    expect(resolved.flexDirection).toBe("row");
    expect(resolved.bg).toBe("#ff0000");
    expect(resolved.gap).toBe(0);
  });

  test("omits undefined properties", () => {
    const style: Style = { padding: 1 };
    const resolved = resolveStyle(style, 100, 40);
    expect(resolved.padding).toBe(1);
    expect(resolved.flexDirection).toBeUndefined();
  });
});
