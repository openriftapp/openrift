import { describe, expect, it } from "vitest";

import { mulberry32 } from "../random.js";
import { makePrinting } from "../test-factories.js";
import type { Card, Printing } from "../types/catalog.js";
import { toBoosterPrintings } from "./input.js";
import { resolveBooster } from "./resolve.js";
import { openBoosterPack, openBoosterPacks } from "./sample.js";
import type { ResolvedBooster } from "./types.js";

let nextId = 0;

function many(
  count: number,
  setSlug: string,
  overrides: Omit<Partial<Printing>, "card"> & { card?: Partial<Card> },
): Printing[] {
  return Array.from({ length: count }, () => {
    nextId += 1;
    return makePrinting({
      printingId: `p-${nextId}`,
      shortCode: `X-${nextId}`,
      setSlug,
      language: "EN",
      rarity: "common",
      finish: "normal",
      artVariant: "normal",
      size: "standard",
      isSigned: false,
      isOvernumbered: false,
      ...overrides,
      card: { types: ["unit"], superTypes: [], ...overrides.card },
    });
  });
}

function setPrintings(setSlug: string): Printing[] {
  return [
    ...many(20, setSlug, { rarity: "common" }),
    ...many(20, setSlug, { rarity: "uncommon" }),
    ...many(20, setSlug, { rarity: "common", finish: "foil" }),
    ...many(20, setSlug, { rarity: "rare", finish: "foil" }),
    ...many(10, setSlug, { rarity: "epic", finish: "foil" }),
    ...many(6, setSlug, { rarity: "showcase", finish: "foil", artVariant: "altart" }),
    ...many(3, setSlug, { rarity: "showcase", finish: "foil", isOvernumbered: true }),
    ...many(3, setSlug, { rarity: "showcase", isOvernumbered: true, isSigned: true }),
    ...many(3, setSlug, { rarity: "showcase", finish: "foil" }),
    ...many(2, setSlug, { rarity: "showcase", artVariant: "ultimate" }),
    ...many(6, setSlug, { card: { types: ["rune"] } }),
    ...many(2, setSlug, { card: { types: ["rune"] }, artVariant: "altart", finish: "foil" }),
    ...many(2, setSlug, { card: { types: ["unit"], superTypes: ["token"] } }),
  ];
}

function resolved(slug: string, setSlug: string): ResolvedBooster {
  const booster = resolveBooster(slug, "EN", toBoosterPrintings(setPrintings(setSlug)));
  if (!booster) {
    throw new Error("did not resolve");
  }
  return booster;
}

function countBy(packs: ReturnType<typeof openBoosterPacks>, outcome: string): number {
  return packs.reduce(
    (sum, pack) => sum + pack.pulls.filter((pull) => pull.outcome === outcome).length,
    0,
  );
}

describe("openBoosterPack", () => {
  it("opens 14 cards in slot order with no repeated printing", () => {
    const pack = openBoosterPack(resolved("origins-booster-pack", "OGN"), mulberry32(1));
    expect(pack.pulls.map((pull) => pull.slot)).toEqual([
      ...Array.from({ length: 7 }, () => "common"),
      ...Array.from({ length: 3 }, () => "uncommon"),
      "foil",
      "rare",
      "rare",
      "rune",
    ]);
    expect(new Set(pack.pulls.map((pull) => pull.printing.printingId)).size).toBe(14);
  });

  it("matches the Origins rates over many packs", () => {
    const n = 100_000;
    const packs = openBoosterPacks(resolved("origins-booster-pack", "OGN"), mulberry32(7), n);
    const relativeError = (outcome: string, perPack: number) =>
      Math.abs(countBy(packs, outcome) / n / perPack - 1);
    expect(relativeError("epic", 0.25)).toBeLessThan(0.02);
    expect(relativeError("alt-art", 1 / 12)).toBeLessThan(0.04);
    expect(relativeError("overnumbered", 1 / 80)).toBeLessThan(0.05);
    expect(relativeError("signed-overnumbered", 1 / 720)).toBeLessThan(0.2);
    expect(relativeError("foil-rare", 1 / 25)).toBeLessThan(0.05);
    expect(relativeError("foil-epic", 1 / 100)).toBeLessThan(0.1);
    expect(relativeError("token", 0.7)).toBeLessThan(0.02);
    expect(relativeError("alt-art-rune", 0.05)).toBeLessThan(0.05);
  }, 30_000);

  it("lets only Radiance's second Rare card hold a premium printing", () => {
    const packs = openBoosterPacks(resolved("radiance-booster-pack", "RAD"), mulberry32(3), 5000);
    const premium = new Set([
      "alt-art",
      "overnumbered",
      "signed-overnumbered",
      "special-alt-art",
      "ultimate",
    ]);
    const firstRare = packs.map((pack) => pack.pulls.find((pull) => pull.slot === "rare"));
    expect(firstRare.some((pull) => pull && premium.has(pull.outcome))).toBe(false);
    expect(countBy(packs, "alt-art")).toBeGreaterThan(0);
    expect(countBy(packs, "epic") / 5000).toBeCloseTo(0.25, 1);
  });

  it("refuses a booster that cannot open", () => {
    const booster = resolved("origins-booster-pack", "OGN");
    expect(() => openBoosterPack({ ...booster, openable: false }, mulberry32(1))).toThrow();
  });
});
