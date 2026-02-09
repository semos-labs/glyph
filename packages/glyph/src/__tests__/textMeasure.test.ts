import { describe, test, expect } from "bun:test";
import { measureText, wrapLines } from "../layout/textMeasure";

describe("measureText", () => {
  test("returns width and height for ASCII text", () => {
    const result = measureText("hello");
    expect(result.width).toBe(5);
    expect(result.height).toBe(1);
  });

  test("returns width 0 for empty string", () => {
    const result = measureText("");
    expect(result.width).toBe(0);
  });

  test("handles unicode emoji (2 cells wide)", () => {
    const result = measureText("👋");
    expect(result.width).toBe(2);
  });

  test("handles CJK characters (2 cells wide)", () => {
    const result = measureText("你好");
    expect(result.width).toBe(4);
  });
});

describe("wrapLines", () => {
  test("wraps text with spaces at word boundaries", () => {
    const result = wrapLines("hello world", 6);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  test("returns array for single word that fits", () => {
    const result = wrapLines("hi", 10);
    expect(Array.isArray(result)).toBe(true);
  });

  test("handles multiple words", () => {
    const result = wrapLines("one two three", 5);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
