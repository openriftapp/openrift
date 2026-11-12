import { describe, expect, it } from "vitest";

import { samePhases } from "./meta-phases.js";

function phase(overrides: Record<string, unknown> = {}) {
  return {
    phaseOrder: 1,
    name: "Swiss",
    roundType: "swiss",
    roundCount: 5,
    rankRequired: null,
    maxGameWins: 2,
    ...overrides,
  };
}

describe("samePhases", () => {
  it("matches the same phases in the same order", () => {
    expect(
      samePhases(
        [phase(), phase({ phaseOrder: 2, name: "Top 8" })],
        [phase(), phase({ phaseOrder: 2, name: "Top 8" })],
      ),
    ).toBe(true);
  });

  it("differs on a changed field, a reorder or a different count", () => {
    expect(samePhases([phase()], [phase({ roundCount: 6 })])).toBe(false);
    expect(
      samePhases([phase(), phase({ phaseOrder: 2 })], [phase({ phaseOrder: 2 }), phase()]),
    ).toBe(false);
    expect(samePhases([phase()], [])).toBe(false);
  });
});
