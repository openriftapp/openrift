import { describe, expect, it } from "vitest";

import { jsonValuesEqual } from "./json-equal.js";

describe("jsonValuesEqual", () => {
  it("treats an undefined property as absent", () => {
    expect(jsonValuesEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(jsonValuesEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it("compares nested objects and arrays by value", () => {
    expect(jsonValuesEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] })).toBe(true);
    expect(jsonValuesEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "y" }] })).toBe(false);
    expect(jsonValuesEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("distinguishes null from a missing or undefined property", () => {
    expect(jsonValuesEqual({ a: null }, {})).toBe(false);
    expect(jsonValuesEqual({ a: null }, { a: undefined })).toBe(false);
  });

  it("does not coerce between types", () => {
    expect(jsonValuesEqual(1, "1")).toBe(false);
    expect(jsonValuesEqual([], {})).toBe(false);
    expect(jsonValuesEqual(null, {})).toBe(false);
  });

  it("compares dates by instant", () => {
    expect(jsonValuesEqual(new Date(0), new Date(0))).toBe(true);
    expect(jsonValuesEqual(new Date(0), new Date(1))).toBe(false);
    expect(jsonValuesEqual(new Date(0), {})).toBe(false);
  });
});
