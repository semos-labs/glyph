import { describe, test, expect } from "bun:test";
import { createMask, masks } from "../utils/mask";

describe("createMask", () => {
  test("creates a mask function", () => {
    const mask = createMask("999-999");
    expect(typeof mask).toBe("function");
  });

  test("returns a string", () => {
    const mask = createMask("999");
    const result = mask("123", "");
    expect(typeof result).toBe("string");
  });

  test("filters non-digit input for digit mask", () => {
    const mask = createMask("999");
    // Non-digits should be filtered out, leaving empty
    expect(mask("abc", "")).toBe("");
  });

  test("accepts digit input for digit mask", () => {
    const mask = createMask("999");
    expect(mask("123", "")).toBe("123");
  });

  test("limits output to mask length", () => {
    const mask = createMask("999");
    // Mask has 3 digit slots, so 1234 should be limited to 123
    expect(mask("1234", "")).toBe("123");
  });
});

describe("masks", () => {
  test("usPhone is a function", () => {
    expect(typeof masks.usPhone).toBe("function");
  });

  test("creditCard is a function", () => {
    expect(typeof masks.creditCard).toBe("function");
  });

  test("ssn is a function", () => {
    expect(typeof masks.ssn).toBe("function");
  });

  test("time is a function", () => {
    expect(typeof masks.time).toBe("function");
  });

  test("dateUS is a function", () => {
    expect(typeof masks.dateUS).toBe("function");
  });

  test("zip is a function", () => {
    expect(typeof masks.zip).toBe("function");
  });
});
