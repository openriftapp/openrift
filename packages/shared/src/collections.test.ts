import { describe, expect, it } from "vitest";

import { boundsOf, chunk, labelMap, mostCommonValue, unique } from "./collections.js";

describe("unique", () => {
  it("returns empty array for empty input", () => {
    expect(unique([])).toEqual([]);
  });

  it("preserves insertion order of first occurrences", () => {
    expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  });

  it("returns same elements when no duplicates", () => {
    expect(unique(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("deduplicates strings", () => {
    expect(unique(["foo", "bar", "foo", "baz", "bar"])).toEqual(["foo", "bar", "baz"]);
  });

  it("handles single-element array", () => {
    expect(unique([42])).toEqual([42]);
  });
});

describe("boundsOf", () => {
  it("returns { min: 0, max: 0 } for empty array", () => {
    expect(boundsOf([])).toEqual({ min: 0, max: 0 });
  });

  it("returns same value for single integer element", () => {
    expect(boundsOf([5])).toEqual({ min: 5, max: 5 });
  });

  it("finds min and max across multiple values", () => {
    expect(boundsOf([3, 1, 7, 2])).toEqual({ min: 1, max: 7 });
  });

  it("floors min and ceils max for fractional values", () => {
    expect(boundsOf([2.3, 5.7])).toEqual({ min: 2, max: 6 });
  });

  it("handles negative values", () => {
    expect(boundsOf([-3.5, 2.1])).toEqual({ min: -4, max: 3 });
  });

  it("handles all-equal values", () => {
    expect(boundsOf([4, 4, 4])).toEqual({ min: 4, max: 4 });
  });

  it("floors and ceils a single fractional value", () => {
    expect(boundsOf([3.5])).toEqual({ min: 3, max: 4 });
  });
});

describe("mostCommonValue", () => {
  it("returns empty string for empty array", () => {
    expect(mostCommonValue([])).toBe("");
  });

  it("returns the single element for single-element array", () => {
    expect(mostCommonValue(["hello"])).toBe("hello");
  });

  it("returns the most frequent value", () => {
    expect(mostCommonValue(["a", "b", "a", "c", "a"])).toBe("a");
  });

  it("returns the first most-frequent value when tied", () => {
    expect(mostCommonValue(["a", "b", "b", "a"])).toBe("a");
  });

  it("handles all-same values", () => {
    expect(mostCommonValue(["x", "x", "x"])).toBe("x");
  });

  it("handles all-unique values (returns first)", () => {
    expect(mostCommonValue(["a", "b", "c"])).toBe("a");
  });
});

describe("labelMap", () => {
  it("keys rows by slug in input order", () => {
    const map = labelMap([
      { slug: "foil", label: "Foil" },
      { slug: "metal-deluxe", label: "Metal Deluxe" },
    ]);
    expect(map).toEqual({ foil: "Foil", "metal-deluxe": "Metal Deluxe" });
    expect(Object.keys(map)).toEqual(["foil", "metal-deluxe"]);
  });

  it("returns an empty object for no rows", () => {
    expect(labelMap([])).toEqual({});
  });
});

describe("chunk", () => {
  it("splits into fixed-size groups with a short tail", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no groups for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("returns one group when the size exceeds the length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("rejects a non-positive or fractional size", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});
