import { describe, expect, it } from "vitest";

import { NO_PENALTY_BREAKDOWN } from "./penalty.js";

describe("NO_PENALTY_BREAKDOWN", () => {
  it("has all ten keys, every one zero", () => {
    expect(Object.keys(NO_PENALTY_BREAKDOWN)).toHaveLength(10);
    expect(Object.values(NO_PENALTY_BREAKDOWN).every((value) => value === 0)).toBe(true);
  });
});
