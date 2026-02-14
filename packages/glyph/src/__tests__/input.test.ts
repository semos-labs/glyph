import { describe, test, expect } from "bun:test";
import { parseKeySequence } from "../runtime/input";

describe("parseKeySequence", () => {
  test("parses regular characters", () => {
    const keys = parseKeySequence("a");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("a");
  });

  test("parses multiple characters", () => {
    const keys = parseKeySequence("abc");
    expect(keys.length).toBe(3);
    expect(keys[0]?.name).toBe("a");
    expect(keys[1]?.name).toBe("b");
    expect(keys[2]?.name).toBe("c");
  });

  test("parses enter key", () => {
    const keys = parseKeySequence("\r");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("return");
  });

  test("parses escape key", () => {
    const keys = parseKeySequence("\x1b");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("escape");
  });

  test("parses backspace", () => {
    const keys = parseKeySequence("\x7f");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("backspace");
  });

  test("parses tab", () => {
    const keys = parseKeySequence("\t");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("tab");
  });

  test("parses space key", () => {
    const keys = parseKeySequence(" ");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("space");
    expect(keys[0]?.sequence).toBe(" ");
  });

  test("parses alt+space", () => {
    const keys = parseKeySequence("\x1b ");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("space");
    expect(keys[0]?.alt).toBe(true);
  });

  test("parses arrow keys", () => {
    expect(parseKeySequence("\x1b[A")[0]?.name).toBe("up");
    expect(parseKeySequence("\x1b[B")[0]?.name).toBe("down");
    expect(parseKeySequence("\x1b[C")[0]?.name).toBe("right");
    expect(parseKeySequence("\x1b[D")[0]?.name).toBe("left");
  });

  test("parses ctrl+letter combinations", () => {
    // Ctrl+A is \x01, Ctrl+C is \x03
    const keysA = parseKeySequence("\x01");
    expect(keysA[0]?.name).toBe("a");
    expect(keysA[0]?.ctrl).toBe(true);

    const keysC = parseKeySequence("\x03");
    expect(keysC[0]?.name).toBe("c");
    expect(keysC[0]?.ctrl).toBe(true);
  });

  test("parses shift+tab (backtab)", () => {
    const keys = parseKeySequence("\x1b[Z");
    expect(keys[0]?.name).toBe("tab");
    expect(keys[0]?.shift).toBe(true);
  });

  test("parses page up/down", () => {
    expect(parseKeySequence("\x1b[5~")[0]?.name).toBe("pageup");
    expect(parseKeySequence("\x1b[6~")[0]?.name).toBe("pagedown");
  });

  test("parses delete key", () => {
    const keys = parseKeySequence("\x1b[3~");
    expect(keys[0]?.name).toBe("delete");
  });

  test("parses uppercase letter as shift+lowercase", () => {
    const keys = parseKeySequence("A");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("a");
    expect(keys[0]?.shift).toBe(true);
    expect(keys[0]?.sequence).toBe("A");
  });

  test("parses lowercase letter without shift", () => {
    const keys = parseKeySequence("a");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("a");
    expect(keys[0]?.shift).toBeUndefined();
  });

  test("parses multiple uppercase letters", () => {
    const keys = parseKeySequence("ABC");
    expect(keys.length).toBe(3);
    expect(keys[0]?.name).toBe("a");
    expect(keys[0]?.shift).toBe(true);
    expect(keys[1]?.name).toBe("b");
    expect(keys[1]?.shift).toBe(true);
    expect(keys[2]?.name).toBe("c");
    expect(keys[2]?.shift).toBe(true);
  });

  test("parses alt+uppercase as alt+shift+lowercase", () => {
    const keys = parseKeySequence("\x1bA");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("a");
    expect(keys[0]?.alt).toBe(true);
    expect(keys[0]?.shift).toBe(true);
  });

  test("parses alt+lowercase without shift", () => {
    const keys = parseKeySequence("\x1ba");
    expect(keys.length).toBe(1);
    expect(keys[0]?.name).toBe("a");
    expect(keys[0]?.alt).toBe(true);
    expect(keys[0]?.shift).toBeUndefined();
  });

  test("shift+arrow via CSI modifier", () => {
    // ESC[1;2A = Shift+Up
    const keys = parseKeySequence("\x1b[1;2A");
    expect(keys[0]?.name).toBe("up");
    expect(keys[0]?.shift).toBe(true);
  });

  test("kitty protocol shift+a via CSI u", () => {
    // ESC[97;2u = Shift+a (Kitty protocol)
    const keys = parseKeySequence("\x1b[97;2u");
    expect(keys[0]?.name).toBe("a");
    expect(keys[0]?.shift).toBe(true);
  });

  test("symbols are not marked as shifted", () => {
    const keys = parseKeySequence("!");
    expect(keys[0]?.name).toBe("!");
    expect(keys[0]?.shift).toBeUndefined();
  });
});
