import { describe, expect, it } from "vitest";

import { stubPriceLookup, stubPrinting } from "@/test/factories";

import { computeCostToComplete } from "./cost-to-complete-chart";

const bird = stubPrinting({
  printingId: "pair",
  side: 1,
  cardId: "bird",
  card: { name: "Bird", slug: "bird", types: ["unit"] },
  otherSide: { faceId: "f", cardId: "gold", cardName: "Gold", cardSlug: "gold", shortCode: "T-05" },
});
const gold = stubPrinting({
  printingId: "pair",
  side: 2,
  cardId: "gold",
  card: { name: "Gold", slug: "gold", types: ["unit"] },
  otherSide: { faceId: "f", cardId: "bird", cardName: "Bird", cardSlug: "bird", shortCode: "T-01" },
});

function compute(countMode: "cards" | "copies") {
  return computeCostToComplete({
    allPrintings: [bird, gold],
    stacks: [],
    scope: {},
    customTagAssignments: {},
    countMode,
    prices: stubPriceLookup({ pair: { cardtrader: 100 } }),
    marketplace: "cardtrader",
  });
}

describe("computeCostToComplete", () => {
  it("charges a double-sided printing once for both of its missing cards", () => {
    const data = compute("cards");

    expect(data.totalCost).toBe(100);
    expect(data.curve.at(-1)?.percent).toBe(100);
    expect(data.curve.at(-1)?.label).toBe("Bird // Gold");
  });

  it("fills both playsets with the same double-sided copies", () => {
    const data = compute("copies");

    expect(data.totalCost).toBe(300);
    expect(data.curve.at(-1)?.percent).toBe(100);
  });
});
