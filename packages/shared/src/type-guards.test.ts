import { describe, expect, it } from "vitest";

import { isRecord } from "./type-guards.js";

describe("isRecord", () => {
  it("accepts a plain object and rejects null, arrays and primitives", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});
