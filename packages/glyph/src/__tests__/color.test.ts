import { describe, test, expect } from "bun:test";
import { colorToRgb, isLightColor, getContrastCursorColor } from "../paint/color";

describe("colorToRgb", () => {
  test("converts black", () => {
    expect(colorToRgb("black")).toEqual([0, 0, 0]);
  });

  test("converts hex colors", () => {
    expect(colorToRgb("#000000")).toEqual([0, 0, 0]);
    expect(colorToRgb("#ffffff")).toEqual([255, 255, 255]);
    expect(colorToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(colorToRgb("#00ff00")).toEqual([0, 255, 0]);
    expect(colorToRgb("#0000ff")).toEqual([0, 0, 255]);
  });

  test("returns null for invalid colors", () => {
    expect(colorToRgb("invalid")).toBeNull();
    expect(colorToRgb("")).toBeNull();
  });
});

describe("isLightColor", () => {
  test("identifies #ffffff as light", () => {
    expect(isLightColor("#ffffff")).toBe(true);
  });

  test("identifies #000000 as dark", () => {
    expect(isLightColor("#000000")).toBe(false);
    expect(isLightColor("black")).toBe(false);
  });
});

describe("getContrastCursorColor", () => {
  test("returns a string color", () => {
    const result = getContrastCursorColor("white");
    expect(typeof result).toBe("string");
  });

  test("returns a string for dark backgrounds", () => {
    const result = getContrastCursorColor("black");
    expect(typeof result).toBe("string");
  });

  test("handles undefined background", () => {
    const result = getContrastCursorColor(undefined);
    expect(typeof result).toBe("string");
  });
});
