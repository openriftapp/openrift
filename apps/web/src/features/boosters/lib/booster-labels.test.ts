import { describe, expect, it } from "vitest";

import {
  boosterBasisLabel,
  boosterName,
  boosterOutcomeLabel,
  boosterSlotLabel,
  perPackLabel,
  perUnitLabel,
} from "./booster-labels";

describe("booster labels", () => {
  it("names a booster after its set", () => {
    expect(boosterName("Origins")).toBe("Origins Booster Pack");
  });

  it("names slots, outcomes and bases, falling back to the slug", () => {
    expect(boosterSlotLabel("rare")).toBe("Rare or better");
    expect(boosterOutcomeLabel("foil-rare")).toBe("Upgrade to Rare");
    expect(boosterOutcomeLabel("mythic")).toBe("mythic");
    expect(boosterBasisLabel("guess")).toBe("Best guess");
  });
});

describe("rate labels", () => {
  it("reads an outcome rate per pack", () => {
    expect(perPackLabel(7)).toBe("7 per pack");
    expect(perPackLabel(1 / 12.5)).toBe("1 in 12.5 packs");
  });

  it("reads a printing's rate per box or case", () => {
    expect(perUnitLabel(7 / 78, 24, "box")).toBe("≈ 2.2 per box");
    expect(perUnitLabel(0.25 / 42, 24, "box")).toBe("1 in 7 boxes");
    expect(perUnitLabel(0.25 / 42, 144, "case")).toBe("≈ 0.9 per case");
  });

  it("marks an upper bound", () => {
    expect(perPackLabel(0.001, "max")).toBe("at most 1 in 1,000 packs");
  });
});
