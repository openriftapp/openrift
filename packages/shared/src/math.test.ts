import { describe, expect, it } from "vitest";

import { clamp, upperMedian } from "./math.js";

describe("clamp", () => {
  it("leaves a value already inside the range alone", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("pulls a value below the range up to the minimum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("pulls a value above the range down to the maximum", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("keeps the bounds themselves", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("collapses an inverted range to the maximum", () => {
    expect(clamp(5, 10, 0)).toBe(0);
  });
});

describe("upperMedian", () => {
  it("takes the middle value of an odd count", () => {
    expect(upperMedian([3, 1, 2])).toBe(2);
  });

  it("takes the upper middle value of an even count", () => {
    expect(upperMedian([4, 1, 3, 2])).toBe(3);
  });

  it("leaves the input order alone", () => {
    const values = [3, 1, 2];
    upperMedian(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it("is undefined for no values", () => {
    expect(upperMedian([])).toBeUndefined();
  });
});
