import type { Printing } from "@openrift/shared/types/catalog";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import {
  groupPrintingDesigns,
  isSelectedSide,
  otherSideOf,
  otherSideSearchSide,
  sortByLanguagePreference,
} from "./printing-designs";

beforeEach(() => {
  resetIdCounter();
});

function printing(shortCode: string, language: string, overrides: Partial<Printing> = {}) {
  return stubPrinting({ setId: "ogn", shortCode, language, ...overrides });
}

function codes(printings: Printing[]) {
  return groupPrintingDesigns(printings).designs.map((design) => [
    design.lead.shortCode,
    [...design.byLanguage.keys()],
  ]);
}

describe("groupPrintingDesigns", () => {
  it("merges printings that differ only in language", () => {
    const printings = [
      printing("OGN-271", "EN"),
      printing("OGN-272", "EN"),
      printing("OGN-271", "KR"),
    ];

    expect(groupPrintingDesigns(printings).languages).toEqual(["EN", "KR"]);
    expect(codes(printings)).toEqual([
      ["OGN-271", ["EN", "KR"]],
      ["OGN-272", ["EN"]],
    ]);
  });

  it("orders designs by set appearance, then short code numerically", () => {
    expect(
      codes([
        printing("OGN-10", "EN"),
        printing("VEN-T04", "EN", { setId: "ven" }),
        printing("OGN-9", "EN"),
        printing("OGN-9a", "SC"),
      ]),
    ).toEqual([
      ["OGN-9", ["EN"]],
      ["OGN-9a", ["SC"]],
      ["OGN-10", ["EN"]],
      ["VEN-T04", ["EN"]],
    ]);
  });

  it("keeps designs apart when the other side differs", () => {
    const otherSide = (cardId: string) => ({
      faceId: `face-${cardId}`,
      cardId,
      cardName: cardId,
      cardSlug: cardId,
      shortCode: "VEN-T05",
    });

    expect(
      codes([
        printing("VEN-T04", "EN", { otherSide: otherSide("empowered") }),
        printing("VEN-T04", "EN", { otherSide: otherSide("mech") }),
        printing("VEN-T04", "SC", { otherSide: otherSide("empowered") }),
        printing("VEN-T04", "SC", { otherSide: otherSide("mech") }),
      ]),
    ).toEqual([
      ["VEN-T04", ["EN", "SC"]],
      ["VEN-T04", ["EN", "SC"]],
    ]);
  });

  it("merges a design whose card sits on a different side per language", () => {
    const otherSide = {
      faceId: "face-buff",
      cardId: "buff",
      cardName: "Buff",
      cardSlug: "buff",
      shortCode: "OGN-272",
    };

    expect(
      codes([
        printing("OGN-271", "EN", { side: 1, otherSide }),
        printing("OGN-271", "SC", { side: 2, otherSide }),
      ]),
    ).toEqual([["OGN-271", ["EN", "SC"]]]);
  });

  it("keeps designs apart on finish, art variant and markers", () => {
    expect(
      codes([
        printing("OGN-1", "EN"),
        printing("OGN-1", "EN", { finish: "foil" }),
        printing("OGN-1", "EN", { artVariant: "altart" }),
        printing("OGN-1", "EN", {
          markers: [{ id: "promo", slug: "promo", label: "Promo", description: null }],
        }),
      ]),
    ).toHaveLength(4);
  });

  it("spills a second same-language printing of one design into a new row", () => {
    expect(
      codes([printing("OGN-1", "EN"), printing("OGN-1", "EN"), printing("OGN-1", "FR")]),
    ).toEqual([
      ["OGN-1", ["EN", "FR"]],
      ["OGN-1", ["EN"]],
    ]);
  });

  it("lists a printing with this card on both sides once, preferring the side with an image", () => {
    const buffSide = {
      faceId: "face-buff-foil",
      cardId: "buff",
      cardName: "Buff",
      cardSlug: "buff",
      shortCode: "OGN-T05",
    };
    const image = { imageId: "img-1" };
    const { designs } = groupPrintingDesigns([
      printing("OGN-T05", "EN", { printingId: "p1", cardId: "buff", side: 1, otherSide: buffSide }),
      printing("OGN-T05", "EN", {
        printingId: "p1",
        cardId: "buff",
        side: 2,
        finish: "foil",
        images: [image],
        otherSide: buffSide,
      }),
    ]);

    expect(designs).toHaveLength(1);
    expect(designs[0]?.lead.side).toBe(2);
  });

  it("returns nothing for no printings", () => {
    expect(groupPrintingDesigns([])).toEqual({ languages: [], designs: [] });
  });
});

describe("isSelectedSide", () => {
  const otherSide = (cardId: string) => ({
    faceId: `face-${cardId}`,
    cardId,
    cardName: cardId,
    cardSlug: cardId,
    shortCode: "OGN-T05",
  });

  it("matches either side of a printing with this card on both sides", () => {
    const entry = printing("OGN-T05", "EN", {
      printingId: "p1",
      cardId: "buff",
      side: 1,
      otherSide: otherSide("buff"),
    });

    expect(isSelectedSide(entry, "p1")).toBe(true);
    expect(isSelectedSide(entry, "p1:2")).toBe(true);
    expect(isSelectedSide(entry, "p2")).toBe(false);
  });

  it("matches only its own side when the other side is another card", () => {
    const entry = printing("OGN-T05", "EN", {
      printingId: "p1",
      cardId: "buff",
      side: 1,
      otherSide: otherSide("recruit"),
    });

    expect(isSelectedSide(entry, "p1")).toBe(true);
    expect(isSelectedSide(entry, "p1:2")).toBe(false);
  });
});

describe("otherSideOf", () => {
  it("finds the other side of the same printing", () => {
    const front = printing("OGN-T05", "EN", { printingId: "p1", side: 1 });
    const back = printing("OGN-T05", "EN", { printingId: "p1", side: 2 });
    const unrelated = printing("OGN-T06", "EN", { printingId: "p2", side: 2 });

    expect(otherSideOf(front, [unrelated, front, back])).toBe(back);
    expect(otherSideOf(back, [front, back])).toBe(front);
    expect(otherSideOf(front, [front, unrelated])).toBeUndefined();
  });
});

describe("otherSideSearchSide", () => {
  const buffSide = {
    faceId: "face-buff",
    cardId: "buff",
    cardName: "Buff",
    cardSlug: "buff",
    shortCode: "OGN-T05",
  };

  it("asks for side 2 from side 1 of a printing with this card on both sides", () => {
    const entry = (side: 1 | 2) =>
      printing("OGN-T05", "EN", { printingId: "p1", cardId: "buff", side, otherSide: buffSide });

    expect(otherSideSearchSide(entry(1))).toBe(2);
    expect(otherSideSearchSide(entry(2))).toBeUndefined();
  });

  it("asks for no side when the other side is another card", () => {
    const entry = printing("OGN-T05", "EN", {
      printingId: "p1",
      cardId: "buff",
      side: 1,
      otherSide: { ...buffSide, cardId: "recruit", cardSlug: "recruit" },
    });

    expect(otherSideSearchSide(entry)).toBeUndefined();
  });
});

describe("sortByLanguagePreference", () => {
  it("puts preferred languages first, in preference order", () => {
    const en = stubPrinting({ language: "EN", canonicalRank: 1 });
    const fr = stubPrinting({ language: "FR", canonicalRank: 2 });
    const sc = stubPrinting({ language: "SC", canonicalRank: 3 });
    expect(sortByLanguagePreference([en, fr, sc], ["SC", "EN"])).toEqual([sc, en, fr]);
  });

  it("orders within a language, and among unlisted languages, by canonical rank", () => {
    const late = stubPrinting({ language: "FR", canonicalRank: 9 });
    const early = stubPrinting({ language: "KR", canonicalRank: 4 });
    const second = stubPrinting({ language: "EN", canonicalRank: 2 });
    const first = stubPrinting({ language: "EN", canonicalRank: 1 });
    expect(sortByLanguagePreference([late, early, second, first], ["EN"])).toEqual([
      first,
      second,
      early,
      late,
    ]);
  });
});
