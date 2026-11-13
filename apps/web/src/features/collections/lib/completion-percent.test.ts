import { describe, expect, it } from "vitest";

import { flooredPercent, formatCompletionPercent } from "./completion-percent";

describe("formatCompletionPercent", () => {
  it("prints one decimal for a partial collection", () => {
    expect(formatCompletionPercent(1, 3)).toBe("33.3%");
  });

  it("prints 100% without a decimal when complete", () => {
    expect(formatCompletionPercent(50, 50)).toBe("100%");
  });

  it("caps an over-complete count at 100%", () => {
    expect(formatCompletionPercent(60, 50)).toBe("100%");
  });

  it("never rounds an incomplete collection up to 100", () => {
    expect(formatCompletionPercent(9999, 10_000)).toBe("99.9%");
  });

  it("floors to a whole percent when asked for no decimals", () => {
    expect(formatCompletionPercent(299, 300, 0)).toBe("99%");
  });

  it("floors exact quotients without float drift", () => {
    expect(formatCompletionPercent(29, 100, 0)).toBe("29%");
    expect(formatCompletionPercent(29, 100)).toBe("29.0%");
  });

  it("prints 0.0% when nothing is owned", () => {
    expect(formatCompletionPercent(0, 10)).toBe("0.0%");
  });

  it("prints 0% for an empty scope", () => {
    expect(formatCompletionPercent(0, 0)).toBe("0%");
  });
});

describe("flooredPercent", () => {
  it("returns the number without a percent sign", () => {
    expect(flooredPercent(1999, 2000, 1)).toBe("99.9");
  });
});
