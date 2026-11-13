import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";

import {
  compareDeckCardsByCurve,
  compareGroupedCards,
  sortCardsLikeSidebar,
  sortOverviewCards,
} from "./deck-card-sort";

describe("compareDeckCardsByCurve", () => {
  it("sorts by energy ascending first", () => {
    const a = stubDeckBuilderCard({ energy: 3, power: 1, cardName: "B" });
    const b = stubDeckBuilderCard({ energy: 1, power: 5, cardName: "A" });
    expect(compareDeckCardsByCurve(a, b)).toBeGreaterThan(0);
    expect(compareDeckCardsByCurve(b, a)).toBeLessThan(0);
  });

  it("breaks energy ties with power ascending", () => {
    const a = stubDeckBuilderCard({ energy: 2, power: 3, cardName: "B" });
    const b = stubDeckBuilderCard({ energy: 2, power: 1, cardName: "A" });
    expect(compareDeckCardsByCurve(a, b)).toBeGreaterThan(0);
  });

  it("breaks remaining ties with card name alphabetical", () => {
    const a = stubDeckBuilderCard({ energy: 2, power: 2, cardName: "Zed" });
    const b = stubDeckBuilderCard({ energy: 2, power: 2, cardName: "Ahri" });
    expect(compareDeckCardsByCurve(a, b)).toBeGreaterThan(0);
  });

  it("treats null energy and power as zero", () => {
    const a = stubDeckBuilderCard({ energy: null, power: null, cardName: "A" });
    const b = stubDeckBuilderCard({ energy: 0, power: 0, cardName: "B" });
    expect(compareDeckCardsByCurve(a, b)).toBeLessThan(0);
  });
});

describe("sortOverviewCards", () => {
  it("returns raw order unchanged for non-grouped zones", () => {
    const cards = [
      stubDeckBuilderCard({ cardId: "x", zone: "legend", energy: 5 }),
      stubDeckBuilderCard({ cardId: "y", zone: "legend", energy: 1 }),
    ];
    const result = sortOverviewCards(cards, "legend");
    expect(result).toBe(cards);
  });

  it("sorts grouped zones by type group (Unit → Spell → Gear) then curve", () => {
    const spell = stubDeckBuilderCard({
      cardId: "spell",
      cardType: "spell",
      energy: 1,
      cardName: "spell",
    });
    const gear = stubDeckBuilderCard({
      cardId: "gear",
      cardType: "gear",
      energy: 1,
      cardName: "gear",
    });
    const unit = stubDeckBuilderCard({
      cardId: "unit",
      cardType: "unit",
      energy: 3,
      cardName: "unit",
    });
    const result = sortOverviewCards([gear, spell, unit], "main");
    expect(result.map((card) => card.cardId)).toEqual(["unit", "spell", "gear"]);
  });

  it("orders multiple cards within a type group by curve", () => {
    const highEnergy = stubDeckBuilderCard({
      cardId: "high",
      cardType: "unit",
      energy: 5,
      cardName: "Zed",
    });
    const lowEnergy = stubDeckBuilderCard({
      cardId: "low",
      cardType: "unit",
      energy: 1,
      cardName: "Ahri",
    });
    const midEnergyHighPower = stubDeckBuilderCard({
      cardId: "mid-high",
      cardType: "unit",
      energy: 3,
      power: 5,
    });
    const midEnergyLowPower = stubDeckBuilderCard({
      cardId: "mid-low",
      cardType: "unit",
      energy: 3,
      power: 1,
    });
    const result = sortOverviewCards(
      [highEnergy, midEnergyHighPower, lowEnergy, midEnergyLowPower],
      "main",
    );
    expect(result.map((card) => card.cardId)).toEqual(["low", "mid-low", "mid-high", "high"]);
  });

  it("appends unknown types after the known type groups", () => {
    const unit = stubDeckBuilderCard({ cardId: "unit", cardType: "unit", cardName: "A" });
    const legend = stubDeckBuilderCard({
      cardId: "legend",
      cardType: "legend",
      cardName: "A",
    });
    const result = sortOverviewCards([legend, unit], "main");
    expect(result.map((card) => card.cardId)).toEqual(["unit", "legend"]);
  });
});

describe("compareGroupedCards", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("orders by type group first (Unit → Spell → Gear)", () => {
    const spell = stubDeckBuilderCard({ cardType: "spell", cardName: "A", energy: 1 });
    const gear = stubDeckBuilderCard({ cardType: "gear", cardName: "A", energy: 1 });
    const unit = stubDeckBuilderCard({ cardType: "unit", cardName: "A", energy: 1 });

    const sorted = [gear, spell, unit].toSorted(compareGroupedCards);

    expect(sorted.map((card) => card.cardType)).toEqual(["unit", "spell", "gear"]);
  });

  it("orders by energy asc within the same type", () => {
    const high = stubDeckBuilderCard({ cardType: "unit", energy: 5, cardName: "B" });
    const low = stubDeckBuilderCard({ cardType: "unit", energy: 1, cardName: "A" });

    const sorted = [high, low].toSorted(compareGroupedCards);

    expect(sorted.map((card) => card.energy)).toEqual([1, 5]);
  });

  it("breaks ties by power, then name", () => {
    const aHighPower = stubDeckBuilderCard({
      cardType: "unit",
      energy: 2,
      power: 4,
      cardName: "Aaa",
    });
    const aLowPower = stubDeckBuilderCard({
      cardType: "unit",
      energy: 2,
      power: 1,
      cardName: "Zzz",
    });
    const bSamePower = stubDeckBuilderCard({
      cardType: "unit",
      energy: 2,
      power: 4,
      cardName: "Zzz",
    });

    const sorted = [bSamePower, aHighPower, aLowPower].toSorted(compareGroupedCards);

    expect(sorted.map((card) => card.cardName)).toEqual(["Zzz", "Aaa", "Zzz"]);
    expect(sorted.map((card) => card.power)).toEqual([1, 4, 4]);
  });

  it("treats null energy/power as 0", () => {
    const hasEnergy = stubDeckBuilderCard({ cardType: "unit", energy: 3, cardName: "A" });
    const nullEnergy = stubDeckBuilderCard({ cardType: "unit", energy: null, cardName: "B" });

    const sorted = [hasEnergy, nullEnergy].toSorted(compareGroupedCards);

    expect(sorted[0]).toBe(nullEnergy);
  });
});

describe("sortCardsLikeSidebar", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  const ZONE_ORDER = [
    "legend",
    "champion",
    "main",
    "battlefield",
    "runes",
    "sideboard",
    "overflow",
  ] as const;

  it("orders cards by zone order", () => {
    const mainCard = stubDeckBuilderCard({ zone: "main", cardType: "unit", cardName: "M" });
    const legendCard = stubDeckBuilderCard({ zone: "legend", cardType: "legend", cardName: "L" });
    const runesCard = stubDeckBuilderCard({ zone: "runes", cardType: "rune", cardName: "R" });

    const sorted = sortCardsLikeSidebar([runesCard, mainCard, legendCard], [...ZONE_ORDER]);

    expect(sorted.map((card) => card.zone)).toEqual(["legend", "main", "runes"]);
  });

  it("sorts cards inside grouped zones but keeps insertion order for non-grouped zones", () => {
    const bfFirst = stubDeckBuilderCard({
      zone: "battlefield",
      cardType: "battlefield",
      cardName: "Zulu",
    });
    const bfSecond = stubDeckBuilderCard({
      zone: "battlefield",
      cardType: "battlefield",
      cardName: "Alpha",
    });
    const mainUnit = stubDeckBuilderCard({
      zone: "main",
      cardType: "unit",
      energy: 3,
      cardName: "Z",
    });
    const mainSpell = stubDeckBuilderCard({
      zone: "main",
      cardType: "spell",
      energy: 1,
      cardName: "A",
    });

    const sorted = sortCardsLikeSidebar([bfFirst, bfSecond, mainUnit, mainSpell], [...ZONE_ORDER]);

    expect(sorted.map((card) => card.cardName)).toEqual(["Z", "A", "Zulu", "Alpha"]);
  });

  it("does not mutate the input array", () => {
    const cards = [
      stubDeckBuilderCard({ zone: "main", cardType: "spell", energy: 5, cardName: "B" }),
      stubDeckBuilderCard({ zone: "main", cardType: "unit", energy: 1, cardName: "A" }),
    ];
    const snapshot = cards.map((card) => card.cardName);

    sortCardsLikeSidebar(cards, [...ZONE_ORDER]);

    expect(cards.map((card) => card.cardName)).toEqual(snapshot);
  });
});
