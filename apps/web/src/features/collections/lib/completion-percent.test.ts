import { describe, expect, it } from "vitest";

import { formatOverallCompletion } from "./completion-percent";

describe("formatOverallCompletion", () => {
  it("prints one decimal for a partial collection", () => {
    expect(formatOverallCompletion(1, 3)).toBe("33.3%");
  });

  it("prints 100% without a decimal when complete", () => {
    expect(formatOverallCompletion(50, 50)).toBe("100%");
  });

  it("caps an over-complete count at 100%", () => {
    expect(formatOverallCompletion(60, 50)).toBe("100%");
  });

  it("never rounds an incomplete collection up to 100", () => {
    expect(formatOverallCompletion(9999, 10_000)).toBe("99.9%");
  });

  it("prints 0.0% when nothing is owned", () => {
    expect(formatOverallCompletion(0, 10)).toBe("0.0%");
  });

  it("prints 0% for an empty scope", () => {
    expect(formatOverallCompletion(0, 0)).toBe("0%");
  });
});
