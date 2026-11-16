import { describe, expect, it } from "vitest";

import { makePrinting } from "../test-factories.js";
import type { Card, Printing } from "../types/catalog.js";
import { auditBooster } from "./audit.js";
import { toBoosterPrintings } from "./input.js";

let nextId = 0;

function side(
  shortCode: string,
  language: string,
  overrides: Omit<Partial<Printing>, "card"> & { card?: Partial<Card> } = {},
): Printing {
  nextId += 1;
  return makePrinting({
    printingId: `p-${nextId}`,
    shortCode,
    setSlug: "OGN",
    language,
    rarity: "common",
    finish: "normal",
    artVariant: "normal",
    size: "standard",
    ...overrides,
    card: { types: ["unit"], superTypes: [], ...overrides.card },
  });
}

function openable(language: string): Printing[] {
  return [
    side("OGN-001", language),
    side("OGN-002", language, { rarity: "uncommon" }),
    side("OGN-003", language, { finish: "foil" }),
    side("OGN-004", language, { rarity: "rare", finish: "foil" }),
    side("OGN-R01", language, { card: { types: ["rune"] } }),
  ];
}

describe("auditBooster", () => {
  it("splits a language's printings into pools, marked, product or oversized, and unreached", () => {
    const inProduct = side("OGN-005", "EN", { rarity: "rare" });
    const oversized = side("OGN-006", "EN", { rarity: "uncommon", size: "oversized" });
    const promo = side("OGN-007", "EN", {
      markers: [{ id: "m", slug: "promo", label: "Promo", description: null }],
    });
    const stray = side("OGN-008", "EN", { rarity: "rare" });
    const printings = [...openable("EN"), inProduct, oversized, promo, stray];
    const audit = auditBooster(
      "origins-booster-pack",
      toBoosterPrintings(printings),
      new Set([inProduct.printingId]),
    );
    const english = audit?.languages.find((entry) => entry.booster.language === "EN");
    expect(english).toMatchObject({
      total: 9,
      inPools: 5,
      markedOrChannel: 1,
      oversizedOrProduct: 2,
    });
    expect(english?.unreached.map((p) => p.shortCode)).toEqual(["OGN-008"]);
  });

  it("lists a short code missing from another language's pool", () => {
    const printings = [...openable("EN"), ...openable("FR"), side("OGN-009", "EN")];
    const audit = auditBooster("origins-booster-pack", toBoosterPrintings(printings), new Set());
    expect(audit?.missing).toEqual([
      { shortCode: "OGN-009", slot: "common", outcome: "common", missingIn: ["FR"] },
    ]);
  });

  it("hides an acknowledged short code in its language", () => {
    const stray = side("OGN-191", "FR", { rarity: "rare" });
    const printings = [...openable("EN"), ...openable("FR"), stray];
    const audit = auditBooster("origins-booster-pack", toBoosterPrintings(printings), new Set());
    const french = audit?.languages.find((entry) => entry.booster.language === "FR");
    expect(french?.unreached).toEqual([]);
    expect(french?.acknowledged.map((p) => p.shortCode)).toEqual(["OGN-191"]);
  });

  it("returns null for an unknown booster", () => {
    expect(auditBooster("nope", [], new Set())).toBeNull();
  });
});
