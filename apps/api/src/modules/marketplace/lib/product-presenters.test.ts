import { describe, expect, it } from "vitest";

import { toVariantSiblings } from "./product-presenters.js";

function row(overrides: Partial<Parameters<typeof toVariantSiblings>[0][number]> = {}) {
  return {
    cardId: "jinx",
    shortCode: "OGN-001",
    language: "EN",
    rarity: "Epic" as const,
    finish: "normal" as const,
    isSigned: false,
    markerSlugs: [],
    otherSide: null,
    ...overrides,
  };
}

describe("toVariantSiblings", () => {
  it("summarizes each card's sides under its card id", () => {
    const summaries = toVariantSiblings(
      [
        row(),
        row({ language: "FR", finish: "foil" }),
        row({ cardId: "recruit", shortCode: "OGN-271", rarity: "Common" as const }),
        row({
          cardId: "recruit",
          shortCode: "OGN-271",
          rarity: "Common" as const,
          otherSide: { cardName: "Sprite", shortCode: "OGN-274" },
        }),
      ],
      new Set(),
    );
    expect(summaries).toEqual({
      jinx: {
        languages: ["EN", "FR"],
        rarities: ["Epic"],
        finishes: ["normal", "foil"],
        markerSlugs: [[]],
        signed: [false],
        otherSides: [],
      },
      recruit: {
        languages: ["EN"],
        rarities: ["Common"],
        finishes: ["normal"],
        markerSlugs: [[]],
        signed: [false],
        otherSides: [{ shortCode: "OGN-271", cardName: "Sprite", otherShortCode: "OGN-274" }],
      },
    });
  });

  it("drops marker slugs with no marker row and keeps the order of the rest", () => {
    const summaries = toVariantSiblings(
      [row({ markerSlugs: ["judge", "stale", "promo"] })],
      new Set(["promo", "judge"]),
    );
    expect(summaries.jinx?.markerSlugs).toEqual([["judge", "promo"]]);
  });

  it("returns no entries for no rows", () => {
    expect(toVariantSiblings([], new Set())).toEqual({});
  });
});
