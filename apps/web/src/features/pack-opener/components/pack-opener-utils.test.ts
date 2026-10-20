import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { boosterPrintings, isBoosterEligible } from "./pack-opener-utils";

describe("isBoosterEligible", () => {
  it("accepts a normal card with no markers", () => {
    expect(isBoosterEligible(stubPrinting({ card: { types: ["unit"] } }))).toBe(true);
  });

  it("rejects a card carrying any marker", () => {
    const printing = stubPrinting({
      card: { types: ["unit"] },
      markers: [{ id: "m-1", slug: "nexus", label: "Nexus", description: null }],
    });
    expect(isBoosterEligible(printing)).toBe(false);
  });

  it("rejects an 'other' type card (buff backsides are not standalone pulls)", () => {
    expect(isBoosterEligible(stubPrinting({ card: { types: ["other"] } }))).toBe(false);
  });

  it("rejects a multi-type card that includes 'other' as a secondary type", () => {
    expect(isBoosterEligible(stubPrinting({ card: { types: ["unit", "other"] } }))).toBe(false);
  });
});

describe("boosterPrintings", () => {
  it("keeps one entry per printing for a double-sided token", () => {
    const bird = stubPrinting({ printingId: "pair", side: 1, card: { types: ["token"] } });
    const gold = stubPrinting({ printingId: "pair", side: 2, card: { types: ["token"] } });
    const single = stubPrinting({ printingId: "single", card: { types: ["unit"] } });
    expect(boosterPrintings([bird, gold, single], "EN")).toEqual([bird, single]);
  });

  it("drops printings in another language", () => {
    const french = stubPrinting({ language: "FR", card: { types: ["unit"] } });
    expect(boosterPrintings([french], "EN")).toEqual([]);
  });
});
