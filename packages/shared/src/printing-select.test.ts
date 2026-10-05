import { describe, expect, it } from "vitest";

import {
  compareWithLanguagePreference,
  deduplicateByCard,
  preferredPrinting,
  sortByLanguageAndCanonicalRank,
} from "./printing-select.js";
import { makePrinting as stubPrinting } from "./test-factories.js";
import type { Printing } from "./types/catalog.js";

function makePrinting(overrides: Partial<Printing> & { language: string }): Printing {
  return stubPrinting({
    id: "p1",
    cardId: "card1",
    setId: "SET-A",
    setSlug: "set-a",
    artVariant: "standard",
    publicCode: "001",
    card: { slug: "card-1", name: "Card 1" },
    ...overrides,
  });
}

describe("sortByLanguageAndCanonicalRank", () => {
  it("returns a new array — does not mutate input", () => {
    const input = [
      makePrinting({ id: "a", language: "EN", canonicalRank: 2 }),
      makePrinting({ id: "b", language: "EN", canonicalRank: 1 }),
    ];
    const output = sortByLanguageAndCanonicalRank(input, ["EN"]);
    expect(output).not.toBe(input);
    expect(input.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("bubbles preferred-language rows to the top", () => {
    const de = makePrinting({ id: "de", language: "DE", canonicalRank: 1 });
    const en = makePrinting({ id: "en", language: "EN", canonicalRank: 5 });
    expect(sortByLanguageAndCanonicalRank([de, en], ["EN", "DE"]).map((p) => p.id)).toEqual([
      "en",
      "de",
    ]);
  });

  it("preserves canonicalRank order within each language bucket", () => {
    const en1 = makePrinting({ id: "en1", language: "EN", canonicalRank: 10 });
    const en2 = makePrinting({ id: "en2", language: "EN", canonicalRank: 20 });
    const de1 = makePrinting({ id: "de1", language: "DE", canonicalRank: 5 });
    expect(sortByLanguageAndCanonicalRank([en2, de1, en1], ["EN", "DE"]).map((p) => p.id)).toEqual([
      "en1",
      "en2",
      "de1",
    ]);
  });

  it("sends unlisted-language rows to the bottom", () => {
    const en = makePrinting({ id: "en", language: "EN", canonicalRank: 10 });
    const sc = makePrinting({ id: "sc", language: "SC", canonicalRank: 1 });
    expect(sortByLanguageAndCanonicalRank([sc, en], ["EN"]).map((p) => p.id)).toEqual(["en", "sc"]);
  });
});

describe("compareWithLanguagePreference", () => {
  const enPrinting = makePrinting({ id: "en", language: "EN" });
  const scPrinting = makePrinting({ id: "sc", language: "SC" });

  it("prefers EN over SC with single-language preference ['EN']", () => {
    expect(compareWithLanguagePreference(enPrinting, scPrinting, ["EN"])).toBeLessThan(0);
    expect(compareWithLanguagePreference(scPrinting, enPrinting, ["EN"])).toBeGreaterThan(0);
  });

  it("prefers SC over EN with single-language preference ['SC']", () => {
    expect(compareWithLanguagePreference(scPrinting, enPrinting, ["SC"])).toBeLessThan(0);
    expect(compareWithLanguagePreference(enPrinting, scPrinting, ["SC"])).toBeGreaterThan(0);
  });

  it("prefers EN over SC with multi-language preference ['EN', 'SC']", () => {
    expect(compareWithLanguagePreference(enPrinting, scPrinting, ["EN", "SC"])).toBeLessThan(0);
  });

  it("returns 0 for same language with equal canonicalRank", () => {
    expect(compareWithLanguagePreference(enPrinting, enPrinting, ["EN"])).toBe(0);
  });

  it("sorts unlisted languages alphabetically after listed ones", () => {
    const dePrinting = makePrinting({ id: "de", language: "DE" });
    const frPrinting = makePrinting({ id: "fr", language: "FR" });
    expect(compareWithLanguagePreference(dePrinting, frPrinting, ["EN"])).toBeLessThan(0);
    expect(compareWithLanguagePreference(frPrinting, dePrinting, ["EN"])).toBeGreaterThan(0);
  });

  it("uses canonicalRank as the tiebreaker when languages are equal", () => {
    const low = makePrinting({ id: "low", language: "EN", canonicalRank: 1 });
    const high = makePrinting({ id: "high", language: "EN", canonicalRank: 2 });
    expect(compareWithLanguagePreference(low, high, ["EN"])).toBeLessThan(0);
    expect(compareWithLanguagePreference(high, low, ["EN"])).toBeGreaterThan(0);
  });
});

describe("deduplicateByCard", () => {
  it("picks EN over SC even when SC comes first in the array", () => {
    const enPrinting = makePrinting({ id: "en", language: "EN" });
    const scPrinting = makePrinting({ id: "sc", language: "SC" });
    const result = deduplicateByCard([scPrinting, enPrinting], ["EN"]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("en");
  });

  it("picks SC printing when language preference is ['SC']", () => {
    const enPrinting = makePrinting({ id: "en", language: "EN" });
    const scPrinting = makePrinting({ id: "sc", language: "SC" });
    const result = deduplicateByCard([enPrinting, scPrinting], ["SC"]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("sc");
  });
});

describe("preferredPrinting", () => {
  it("returns EN printing with single-language preference ['EN']", () => {
    const enPrinting = makePrinting({ id: "en", language: "EN" });
    const scPrinting = makePrinting({ id: "sc", language: "SC" });
    const result = preferredPrinting([scPrinting, enPrinting], ["EN"]);
    expect(result?.id).toBe("en");
  });

  it("returns undefined for empty array", () => {
    expect(preferredPrinting([], ["EN"])).toBeUndefined();
  });
});
