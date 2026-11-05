import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import { oddsGroupPresets, oddsGroupRow } from "@/features/decks/lib/deck-odds-groups";
import { energyCurveTotals, turnOnePlayChances } from "@/features/decks/lib/deck-stats-summary";
import { stubDeckBuilderCard } from "@/test/factories";

const TYPE_LABELS = { unit: "Unit", spell: "Spell", gear: "Gear" };

const main = (overrides: Parameters<typeof stubDeckBuilderCard>[0] = {}) =>
  stubDeckBuilderCard({ zone: WellKnown.deckZone.MAIN, ...overrides });

describe("turnOnePlayChances", () => {
  it("reads the going-first and going-second presets the odds panel uses", () => {
    const cards = [
      main({ cardTypes: ["unit"], energy: 2, quantity: 3 }),
      main({ cardTypes: ["unit"], energy: 3, quantity: 3 }),
      main({ cardTypes: ["spell"], energy: 1, quantity: 3 }),
      main({ cardTypes: ["unit"], energy: 6, quantity: 30 }),
    ];
    const presets = oddsGroupPresets(cards, TYPE_LABELS);
    const first = presets.find((preset) => preset.key === "turn-one-first");
    const second = presets.find((preset) => preset.key === "turn-one-second");
    if (!first || !second) {
      throw new Error("turn-one presets missing");
    }
    expect(turnOnePlayChances(cards, TYPE_LABELS)).toEqual({
      first: oddsGroupRow(cards, first).openingChance,
      second: oddsGroupRow(cards, second).openingChance,
    });
  });

  it("counts more turn-one plays going second, where 3-energy cards qualify", () => {
    const cards = [
      main({ cardTypes: ["unit"], energy: 3, quantity: 6 }),
      main({ cardTypes: ["unit"], energy: 6, quantity: 33 }),
    ];
    const chances = turnOnePlayChances(cards, TYPE_LABELS);
    expect(chances?.first).toBe(0);
    expect(chances?.second).toBeGreaterThan(0);
  });
});

describe("energyCurveTotals", () => {
  it("sums every domain stack per energy value", () => {
    const stacks = [
      { key: "fury", domains: ["fury" as const] },
      { key: "fury+calm", domains: ["fury" as const, "calm" as const] },
    ];
    expect(
      energyCurveTotals(
        [
          { energy: "1", fury: 2, "fury+calm": 1 },
          { energy: "2", fury: 0, "fury+calm": 0 },
        ],
        stacks,
      ),
    ).toEqual([
      { energy: "1", count: 3 },
      { energy: "2", count: 0 },
    ]);
  });

  it("treats a missing stack key as zero", () => {
    expect(energyCurveTotals([{ energy: "4" }], [{ key: "mind", domains: ["mind"] }])).toEqual([
      { energy: "4", count: 0 },
    ]);
  });
});
