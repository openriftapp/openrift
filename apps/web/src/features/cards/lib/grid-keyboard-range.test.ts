import { describe, expect, it } from "vitest";

import { keyboardRowRange } from "./grid-keyboard-range";

const range = { startIndex: 0, endIndex: 3, overscan: 3, count: 12 };

describe("keyboardRowRange", () => {
  it("keeps the virtualizer's rows while nothing in the grid has keyboard focus", () => {
    expect(keyboardRowRange(range, null)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("adds the row after the last mounted one once keyboard focus reaches it", () => {
    expect(keyboardRowRange(range, 6)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("mounts a focused row far from the viewport with both neighbours", () => {
    expect(keyboardRowRange(range, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 9, 10]);
  });

  it("stays inside the row count", () => {
    expect(keyboardRowRange(range, 11)).toEqual([0, 1, 2, 3, 4, 5, 6, 10, 11]);
  });
});
