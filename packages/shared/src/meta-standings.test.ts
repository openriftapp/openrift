import { describe, expect, it } from "vitest";

import type { CutPhase } from "./meta-standings.js";
import { cutPhaseOrders, cutSizeOf, formatRank, formatRecord } from "./meta-standings.js";

describe("formatRank", () => {
  it("renders an exact standing as an ordinal", () => {
    expect(formatRank(1, false)).toBe("1st");
    expect(formatRank(2, false)).toBe("2nd");
    expect(formatRank(3, false)).toBe("3rd");
    expect(formatRank(4, false)).toBe("4th");
    expect(formatRank(8, false)).toBe("8th");
    expect(formatRank(21, false)).toBe("21st");
    expect(formatRank(102, false)).toBe("102nd");
  });

  it("renders the teens as -th, not as their last digit", () => {
    expect(formatRank(11, false)).toBe("11th");
    expect(formatRank(12, false)).toBe("12th");
    expect(formatRank(13, false)).toBe("13th");
    expect(formatRank(111, false)).toBe("111th");
    expect(formatRank(113, false)).toBe("113th");
  });

  it("keeps the podium when the rank is a cut bucket", () => {
    expect(formatRank(1, true)).toBe("1st");
    expect(formatRank(2, true)).toBe("2nd");
  });

  it("renders a cut bucket from third place up", () => {
    expect(formatRank(3, true)).toBe("T3");
    expect(formatRank(4, true)).toBe("T4");
    expect(formatRank(8, true)).toBe("T8");
    expect(formatRank(16, true)).toBe("T16");
  });
});

describe("formatRecord", () => {
  it("always renders all three parts", () => {
    expect(formatRecord(5, 1, 2)).toBe("5-1-2");
    expect(formatRecord(5, 1, 0)).toBe("5-1-0");
    expect(formatRecord(14, 1, 0)).toBe("14-1-0");
  });

  it("counts an unpublished draw column as no draws", () => {
    expect(formatRecord(5, 1, null)).toBe("5-1-0");
    expect(formatRecord(0, 3, null)).toBe("0-3-0");
  });

  it("renders nothing without both wins and losses", () => {
    expect(formatRecord(null, null, null)).toBeNull();
    expect(formatRecord(5, null, null)).toBeNull();
    expect(formatRecord(null, 1, 0)).toBeNull();
  });
});

function phase(overrides: Partial<CutPhase> = {}): CutPhase {
  return {
    phaseOrder: 1,
    roundType: "RANKED_SINGLE_ELIMINATION",
    roundCount: 3,
    rankRequired: null,
    ...overrides,
  };
}

describe("cutPhaseOrders", () => {
  it("names the elimination phases and leaves the Swiss rounds out", () => {
    const orders = cutPhaseOrders([
      phase({ phaseOrder: 0, roundType: "SWISS" }),
      phase({ phaseOrder: 1 }),
      phase({ phaseOrder: 2, roundType: "ranked_single_elimination" }),
    ]);

    expect([...orders]).toEqual([1, 2]);
  });
});

describe("cutSizeOf", () => {
  it("reads the size off the rank a phase required", () => {
    expect(cutSizeOf([phase({ rankRequired: 16 })])).toBe(16);
  });

  it("derives the size from the round count when no rank was recorded", () => {
    expect(cutSizeOf([phase({ roundCount: 3 })])).toBe(8);
  });

  it("keeps the largest elimination phase, so a third-place playoff cannot shrink the cut", () => {
    expect(
      cutSizeOf([
        phase({ phaseOrder: 1, rankRequired: 8 }),
        phase({ phaseOrder: 2, roundCount: 1 }),
      ]),
    ).toBe(8);
  });

  it("answers nothing for an event that ran no cut", () => {
    expect(cutSizeOf([phase({ roundType: "SWISS" })])).toBeNull();
    expect(cutSizeOf([phase({ roundCount: null })])).toBeNull();
    expect(cutSizeOf([])).toBeNull();
  });
});
