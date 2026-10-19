import type { Printing } from "@openrift/shared/types/catalog";
import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import { groupPrintingDesigns } from "./printing-designs";

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
    const otherSide = { faceId: "face-buff", cardId: "buff", cardName: "Buff", cardSlug: "buff" };

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

  it("returns nothing for no printings", () => {
    expect(groupPrintingDesigns([])).toEqual({ languages: [], designs: [] });
  });
});
