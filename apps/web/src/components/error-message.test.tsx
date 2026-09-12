import { describe, expect, it } from "vitest";

import { errorEmojis, errorHeadings, errorSubtexts, pick } from "./error-message";

describe("pick", () => {
  it("returns the same element for the same seed", () => {
    expect(pick(errorHeadings(), "abc")).toBe(pick(errorHeadings(), "abc"));
    expect(pick(errorEmojis(), "xyz:emoji")).toBe(pick(errorEmojis(), "xyz:emoji"));
  });

  it("distributes across the array for varied seeds", () => {
    const seeds = Array.from({ length: 200 }, (_, index) => `seed-${index}`);
    const picked = new Set(seeds.map((seed) => pick(errorSubtexts(), seed)));
    expect(picked.size).toBeGreaterThan(1);
  });

  it("handles empty-string seeds", () => {
    expect(pick(errorHeadings(), "")).toBe(errorHeadings()[0]);
  });

  it("handles non-ASCII seeds deterministically", () => {
    expect(pick(errorHeadings(), "über 💥")).toBe(pick(errorHeadings(), "über 💥"));
  });
});
