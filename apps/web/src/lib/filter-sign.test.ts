import { describe, expect, it } from "vitest";

import { cycleFlag, dimensionSign, flipSignedValues, toggleSignedValue } from "./filter-sign";

describe("dimensionSign", () => {
  it("is null for an empty dimension", () => {
    expect(dimensionSign([], [])).toBeNull();
  });

  it("is include when values are included", () => {
    expect(dimensionSign(["a"], [])).toBe("include");
  });

  it("is exclude when values are only excluded", () => {
    expect(dimensionSign([], ["a"])).toBe("exclude");
  });

  it("reads a dimension with both lists filled as include", () => {
    expect(dimensionSign(["a"], ["b"])).toBe("include");
  });
});

describe("toggleSignedValue", () => {
  it("adds a value to the include list", () => {
    expect(toggleSignedValue(["a"], [], "b", "include")).toEqual({
      included: ["a", "b"],
      excluded: [],
    });
  });

  it("removes an included value instead of excluding it", () => {
    expect(toggleSignedValue(["a"], [], "a", "include")).toEqual({ included: [], excluded: [] });
  });

  it("adds a value to the exclude list", () => {
    expect(toggleSignedValue([], ["a"], "b", "exclude")).toEqual({
      included: [],
      excluded: ["a", "b"],
    });
  });

  it("removes an excluded value", () => {
    expect(toggleSignedValue([], ["a"], "a", "exclude")).toEqual({ included: [], excluded: [] });
  });

  it("moves a value out of the other list and keeps the rest of it", () => {
    expect(toggleSignedValue(["a"], ["b", "c"], "b", "include")).toEqual({
      included: ["a", "b"],
      excluded: ["c"],
    });
  });

  it("excludes directly on an empty dimension", () => {
    expect(toggleSignedValue([], [], "a", "exclude")).toEqual({ included: [], excluded: ["a"] });
  });
});

describe("flipSignedValues", () => {
  it("moves every included value to the exclude list", () => {
    expect(flipSignedValues(["a", "b"], [])).toEqual({ included: [], excluded: ["a", "b"] });
  });

  it("moves every excluded value to the include list", () => {
    expect(flipSignedValues([], ["a"])).toEqual({ included: ["a"], excluded: [] });
  });

  it("moves a mixed dimension to exclude without dropping values", () => {
    expect(flipSignedValues(["a"], ["b"])).toEqual({ included: [], excluded: ["b", "a"] });
  });
});

describe("cycleFlag", () => {
  it("cycles off → yes → no → off", () => {
    expect(cycleFlag(null)).toBe(true);
    expect(cycleFlag(true)).toBe(false);
    expect(cycleFlag(false)).toBeNull();
  });
});
