import { describe, test, expect } from "bun:test";
import { Framebuffer } from "../paint/framebuffer";

describe("Framebuffer", () => {
  test("creates with specified dimensions", () => {
    const fb = new Framebuffer(80, 24);
    expect(fb.width).toBe(80);
    expect(fb.height).toBe(24);
  });

  test("cells are initialized to space", () => {
    const fb = new Framebuffer(10, 5);
    const cell = fb.get(0, 0);
    expect(cell?.ch).toBe(" ");
    expect(cell?.fg).toBeUndefined();
    expect(cell?.bg).toBeUndefined();
  });

  test("setChar updates cell content", () => {
    const fb = new Framebuffer(10, 5);
    fb.setChar(0, 0, "A", "red", "blue");

    const cell = fb.get(0, 0);
    expect(cell?.ch).toBe("A");
    expect(cell?.fg).toBe("red");
    expect(cell?.bg).toBe("blue");
  });

  test("setChar with partial styles", () => {
    const fb = new Framebuffer(10, 5);
    fb.setChar(0, 0, "X", "white");

    const cell = fb.get(0, 0);
    expect(cell?.ch).toBe("X");
    expect(cell?.fg).toBe("white");
    expect(cell?.bg).toBeUndefined();
  });

  test("setChar with style flags", () => {
    const fb = new Framebuffer(10, 5);
    fb.setChar(0, 0, "B", "white", "black", true, false, true, false);

    const cell = fb.get(0, 0);
    expect(cell?.bold).toBe(true);
    expect(cell?.dim).toBe(false);
    expect(cell?.italic).toBe(true);
    expect(cell?.underline).toBe(false);
  });

  test("get returns undefined for out of bounds", () => {
    const fb = new Framebuffer(10, 5);
    expect(fb.get(-1, 0)).toBeUndefined();
    expect(fb.get(0, -1)).toBeUndefined();
    expect(fb.get(100, 0)).toBeUndefined();
    expect(fb.get(0, 100)).toBeUndefined();
  });

  test("setChar ignores out of bounds writes", () => {
    const fb = new Framebuffer(10, 5);
    // Should not throw
    fb.setChar(-1, 0, "X");
    fb.setChar(100, 0, "X");
    fb.setChar(0, -1, "X");
    fb.setChar(0, 100, "X");
  });

  test("clear resets all cells", () => {
    const fb = new Framebuffer(10, 5);
    fb.setChar(0, 0, "A", "red", "blue");
    fb.setChar(5, 2, "B", "green", "yellow");

    fb.clear();

    expect(fb.get(0, 0)?.ch).toBe(" ");
    expect(fb.get(5, 2)?.ch).toBe(" ");
  });

  test("resize changes dimensions", () => {
    const fb = new Framebuffer(10, 5);
    fb.setChar(0, 0, "A");

    fb.resize(20, 10);

    expect(fb.width).toBe(20);
    expect(fb.height).toBe(10);
  });

  test("fillRect fills rectangular area", () => {
    const fb = new Framebuffer(10, 10);
    fb.fillRect(2, 2, 3, 3, "#", "white", "blue");

    // Inside the rect
    expect(fb.get(2, 2)?.ch).toBe("#");
    expect(fb.get(3, 3)?.ch).toBe("#");
    expect(fb.get(4, 4)?.ch).toBe("#");

    // Outside the rect
    expect(fb.get(0, 0)?.ch).toBe(" ");
    expect(fb.get(5, 5)?.ch).toBe(" ");
  });

  test("clone creates independent copy", () => {
    const fb = new Framebuffer(10, 5);
    fb.setChar(0, 0, "A", "red");

    const clone = fb.clone();

    // Clone has same content
    expect(clone.get(0, 0)?.ch).toBe("A");
    expect(clone.get(0, 0)?.fg).toBe("red");

    // Modifying original doesn't affect clone
    fb.setChar(0, 0, "B");
    expect(clone.get(0, 0)?.ch).toBe("A");
  });
});
