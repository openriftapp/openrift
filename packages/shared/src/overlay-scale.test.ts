import { describe, expect, it } from "vitest";

import { clampRevealCount } from "./overlay-scale.js";

describe("clampRevealCount", () => {
  it("keeps a count inside the board", () => {
    expect(clampRevealCount(3, 5)).toBe(3);
  });

  it("holds a count to the board's ends", () => {
    expect(clampRevealCount(-2, 5)).toBe(0);
    expect(clampRevealCount(9, 5)).toBe(5);
  });

  it("reveals nothing on an empty board", () => {
    expect(clampRevealCount(4, 0)).toBe(0);
    expect(clampRevealCount(4, -1)).toBe(0);
  });
});
