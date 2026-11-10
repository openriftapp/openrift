import { describe, expect, it } from "vitest";

import { pick } from "./error-message";

const items = ["a", "b", "c", "d", "e"];

describe("pick", () => {
  it("returns the same element for the same seed", () => {
    expect(pick(items, "abc")).toBe(pick(items, "abc"));
  });

  it("distributes across the array for varied seeds", () => {
    const seeds = Array.from({ length: 200 }, (_, index) => `seed-${index}`);
    const picked = new Set(seeds.map((seed) => pick(items, seed)));
    expect(picked.size).toBeGreaterThan(1);
  });

  it("handles empty-string seeds", () => {
    expect(pick(items, "")).toBe(items[0]);
  });

  it("handles non-ASCII seeds deterministically", () => {
    expect(pick(items, "über 💥")).toBe(pick(items, "über 💥"));
  });
});
