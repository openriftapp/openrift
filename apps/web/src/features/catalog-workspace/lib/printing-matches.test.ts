import { describe, expect, it } from "vitest";

import { closestPrintings } from "./printing-matches";

const candidate = {
  shortCode: "OGN-193b",
  language: "SC",
  finish: "foil",
  artVariant: "alt-art",
  rarity: "showcase",
  size: null,
  isSigned: null,
  markerSlugs: [] as string[],
};

function printing(id: string, overrides: Partial<typeof base> = {}) {
  return { ...base, id, ...overrides };
}

const base = {
  id: "p",
  shortCode: "OGN-193b",
  language: "SC",
  finish: "foil",
  artVariant: "alt-art",
  rarity: "showcase",
  size: "standard",
  isSigned: false,
  markerSlugs: [] as string[],
  canonicalRank: 1,
};

describe("closestPrintings", () => {
  it("lists printings with the same code and language, fewest differences first", () => {
    const result = closestPrintings(candidate, [
      printing("promo", { markerSlugs: ["promo", "champion"], canonicalRank: 1 }),
      printing("exact", { canonicalRank: 2 }),
      printing("normal-finish", { finish: "normal", markerSlugs: ["promo"], canonicalRank: 3 }),
    ]);
    expect(result.matches.map((match) => [match.printing.id, match.differs])).toEqual([
      ["exact", []],
      ["promo", ["markerSlugs"]],
      ["normal-finish", ["finish", "markerSlugs"]],
    ]);
  });

  it("counts other languages of the same code without listing them", () => {
    const result = closestPrintings(candidate, [
      printing("en", { language: "EN" }),
      printing("tc", { language: "TC" }),
      printing("other-code", { shortCode: "OGN-193" }),
    ]);
    expect(result.matches).toEqual([]);
    expect(result.sameCodeOtherLanguages).toBe(2);
  });

  it("does not count a value the source leaves empty as a difference", () => {
    const result = closestPrintings({ ...candidate, rarity: null }, [
      printing("rare", { rarity: "rare", size: "oversized", isSigned: true }),
    ]);
    expect(result.matches[0]?.differs).toEqual([]);
  });

  it("compares markers as a set", () => {
    const result = closestPrintings({ ...candidate, markerSlugs: ["top-4", "promo"] }, [
      printing("same", { markerSlugs: ["promo", "top-4"] }),
    ]);
    expect(result.matches[0]?.differs).toEqual([]);
  });

  it("matches any language when the source names none", () => {
    const result = closestPrintings({ ...candidate, language: null }, [
      printing("en", { language: "EN" }),
    ]);
    expect(result.matches).toHaveLength(1);
    expect(result.sameCodeOtherLanguages).toBe(0);
  });
});
