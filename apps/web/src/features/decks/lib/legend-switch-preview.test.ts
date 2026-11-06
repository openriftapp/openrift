import type { Domain } from "@openrift/shared/types/enums";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubDeckBuilderCard } from "@/test/factories";

import { previewLegendSwitch, runeRefillPlan, simulateLegendSwitch } from "./legend-switch-preview";

const rune = (cardId: string, domain: string, quantity: number) =>
  stubDeckBuilderCard({
    cardId,
    cardName: `${cardId} name`,
    cardType: "rune",
    zone: "runes",
    domains: [domain as Domain],
    quantity,
  });

const legendOf = (domains: string[], tags: string[] = []) =>
  stubDeckBuilderCard({
    cardId: "legend",
    cardType: "legend",
    zone: "legend",
    domains: domains as Domain[],
    tags,
  });

const mainCard = (cardId: string, zone: "main" | "sideboard" | "overflow", domain: string) =>
  stubDeckBuilderCard({ cardId, zone, domains: [domain as Domain] });

beforeEach(() => {
  resetIdCounter();
});

describe("runeRefillPlan", () => {
  it("returns an empty plan for no cards and no legend domains", () => {
    expect(runeRefillPlan([], []).size).toBe(0);
  });

  it("returns an empty plan for a mono-domain legend", () => {
    expect(runeRefillPlan([rune("r1", "fury", 2)], ["fury"]).size).toBe(0);
  });

  it("tops up each domain to 6 when no runes are held", () => {
    expect(runeRefillPlan([], ["fury", "calm"])).toEqual(
      new Map([
        ["fury", 6],
        ["calm", 6],
      ]),
    );
  });

  it("adds only the missing copies per domain", () => {
    const plan = runeRefillPlan([rune("r1", "fury", 4), rune("r2", "calm", 1)], ["fury", "calm"]);
    expect(plan).toEqual(
      new Map([
        ["fury", 2],
        ["calm", 5],
      ]),
    );
  });

  it("omits domains already at 6", () => {
    const plan = runeRefillPlan([rune("r1", "fury", 6)], ["fury", "calm"]);
    expect(plan).toEqual(new Map([["calm", 6]]));
  });

  it("returns an empty plan when both domains are full", () => {
    const plan = runeRefillPlan([rune("r1", "fury", 6), rune("r2", "calm", 6)], ["fury", "calm"]);
    expect(plan.size).toBe(0);
  });

  it("does not count runes outside the legend's domains", () => {
    const plan = runeRefillPlan([rune("r1", "mind", 6)], ["fury", "calm"]);
    expect(plan).toEqual(
      new Map([
        ["fury", 6],
        ["calm", 6],
      ]),
    );
  });

  it("ignores non-rune cards", () => {
    const plan = runeRefillPlan([mainCard("m", "main", "fury")], ["fury", "calm"]);
    expect(plan.get("fury")).toBe(6);
  });

  it("sums several rune entries of the same domain", () => {
    const plan = runeRefillPlan([rune("r1", "fury", 2), rune("r2", "fury", 3)], ["fury", "calm"]);
    expect(plan.get("fury")).toBe(1);
  });
});

const runesByDomain = new Map([
  ["fury", [rune("cat-fury", "fury", 1)]],
  ["calm", [rune("cat-calm", "calm", 1)]],
  ["mind", [rune("cat-mind", "mind", 1)]],
]);

const context = {
  format: "constructed" as const,
  formatConfig: null,
  championIdentifierTags: new Set<string>(),
  customTagAssignments: {},
};

const runesOf = (cards: { zone: string; cardId: string; quantity: number }[]) =>
  cards
    .filter((card) => card.zone === "runes")
    .map((card) => [card.cardId, card.quantity])
    .toSorted(([a], [b]) => String(a).localeCompare(String(b)));

describe("simulateLegendSwitch", () => {
  it("replaces the current legend", () => {
    const old = { ...legendOf(["fury", "calm"]), cardId: "old" };
    const after = simulateLegendSwitch(
      [old],
      legendOf(["fury", "mind"]),
      runesByDomain,
      "constructed",
    );
    expect(after.filter((card) => card.zone === "legend").map((card) => card.cardId)).toEqual([
      "legend",
    ]);
  });

  it("refills from the catalog when runes remain", () => {
    const cards = [rune("r-fury", "fury", 6), rune("r-calm", "calm", 6)];
    const after = simulateLegendSwitch(
      cards,
      legendOf(["fury", "mind"]),
      runesByDomain,
      "constructed",
    );
    expect(runesOf(after)).toEqual([
      ["cat-mind", 6],
      ["r-fury", 6],
    ]);
  });

  it("merges a refill into an existing default-printing row", () => {
    const cards = [rune("cat-fury", "fury", 4), rune("r-calm", "calm", 6)];
    const after = simulateLegendSwitch(
      cards,
      legendOf(["fury", "calm"]),
      runesByDomain,
      "constructed",
    );
    expect(runesOf(after)).toEqual([
      ["cat-fury", 6],
      ["r-calm", 6],
    ]);
  });

  it("auto-populates round-robin when no runes remain", () => {
    const twoFury = new Map([
      ["fury", [rune("fury-a", "fury", 1), rune("fury-b", "fury", 1)]],
      ["mind", [rune("cat-mind", "mind", 1)]],
    ]);
    const after = simulateLegendSwitch(
      [rune("r-calm", "calm", 12)],
      legendOf(["fury", "mind"]),
      twoFury,
      "constructed",
    );
    expect(runesOf(after)).toEqual([
      ["cat-mind", 6],
      ["fury-a", 3],
      ["fury-b", 3],
    ]);
  });

  it("adds no runes for a mono-domain legend without runes", () => {
    const after = simulateLegendSwitch([], legendOf(["fury"]), runesByDomain, "constructed");
    expect(runesOf(after)).toEqual([]);
  });

  it("adds a legend copy in freeform without touching runes", () => {
    const cards = [rune("r-calm", "calm", 6)];
    const after = simulateLegendSwitch(
      cards,
      legendOf(["fury", "mind"]),
      runesByDomain,
      "freeform",
    );
    expect(runesOf(after)).toEqual([["r-calm", 6]]);
    expect(after.filter((card) => card.zone === "legend")).toHaveLength(1);
  });
});

describe("previewLegendSwitch", () => {
  it("lists rune removals and additions with the total after the switch", () => {
    const cards = [rune("r-fury", "fury", 6), rune("r-calm", "calm", 6)];
    const preview = previewLegendSwitch(cards, legendOf(["fury", "mind"]), runesByDomain, context);
    expect(preview.runesRemoved).toEqual([{ name: "r-calm name", quantity: 6 }]);
    expect(preview.runesAdded).toEqual([{ name: "cat-mind name", quantity: 6 }]);
    expect(preview.runeTotalAfter).toBe(12);
  });

  it("reports no rune changes for a legend with the same domains", () => {
    const cards = [rune("r-fury", "fury", 6), rune("r-calm", "calm", 6)];
    const preview = previewLegendSwitch(cards, legendOf(["calm", "fury"]), runesByDomain, context);
    expect(preview.runesRemoved).toEqual([]);
    expect(preview.runesAdded).toEqual([]);
  });

  it("counts off-domain Main and Sideboard copies from the rule checker", () => {
    const cards = [
      { ...mainCard("off-main", "main", "mind"), quantity: 3 },
      mainCard("off-side", "sideboard", "mind"),
      mainCard("off-over", "overflow", "mind"),
      mainCard("on", "main", "fury"),
      mainCard("neutral", "main", "neutral"),
    ];
    const preview = previewLegendSwitch(cards, legendOf(["fury", "calm"]), runesByDomain, context);
    expect(preview.offColorCount).toBe(4);
    expect(preview.newViolations.map((violation) => violation.code)).not.toContain(
      "DOMAIN_MISMATCH",
    );
  });

  it("counts cards that were already off-domain before the switch", () => {
    const old = { ...legendOf(["fury", "calm"]), cardId: "old" };
    const cards = [old, mainCard("off", "main", "mind")];
    const preview = previewLegendSwitch(cards, legendOf(["fury", "body"]), runesByDomain, context);
    expect(preview.offColorCount).toBe(1);
  });

  it("keeps a champion that shares a tag with the new legend legal", () => {
    const champion = stubDeckBuilderCard({ zone: "champion", cardName: "Jinx", tags: ["jinx"] });
    const preview = previewLegendSwitch(
      [champion],
      legendOf(["fury", "calm"], ["jinx"]),
      runesByDomain,
      context,
    );
    expect(preview.champion?.cardName).toBe("Jinx");
    expect(preview.championLegal).toBe(true);
  });

  it("flags a champion that no longer matches the legend", () => {
    const old = { ...legendOf(["fury", "calm"], ["vi"]), cardId: "old" };
    const champion = stubDeckBuilderCard({ zone: "champion", tags: ["vi"] });
    const preview = previewLegendSwitch(
      [old, champion],
      legendOf(["fury", "calm"], ["jinx"]),
      runesByDomain,
      context,
    );
    expect(preview.championLegal).toBe(false);
    expect(preview.newViolations.map((violation) => violation.code)).not.toContain(
      "CHAMPION_LEGEND_MISMATCH",
    );
  });

  it("reports no champion when the deck has none", () => {
    const preview = previewLegendSwitch([], legendOf(["fury", "calm"]), runesByDomain, context);
    expect(preview.champion).toBeNull();
  });

  it("lists violations that appear only after the switch", () => {
    const old = { ...legendOf(["fury", "calm"]), cardId: "old" };
    const cards = [old, rune("r-fury", "fury", 6), rune("r-calm", "calm", 6)];
    const preview = previewLegendSwitch(cards, legendOf(["fury", "mind"]), new Map(), context);
    expect(preview.newViolations.map((violation) => violation.code)).toContain("RUNES_TOO_FEW");
  });

  it("does not report a violation that already existed as new", () => {
    const old = { ...legendOf(["fury", "calm"]), cardId: "old" };
    const preview = previewLegendSwitch([old], legendOf(["fury", "mind"]), new Map(), context);
    expect(preview.newViolations.map((violation) => violation.code)).not.toContain(
      "CHAMPION_REQUIRED",
    );
  });

  it("lists violations the switch resolves", () => {
    const old = { ...legendOf(["fury", "calm"]), cardId: "old" };
    const cards = [old, rune("r-fury", "fury", 6), rune("r-mind", "mind", 6)];
    const preview = previewLegendSwitch(cards, legendOf(["fury", "mind"]), runesByDomain, context);
    expect(preview.resolvedViolations.map((violation) => violation.code)).toContain(
      "RUNE_DOMAIN_MISMATCH",
    );
  });
});
