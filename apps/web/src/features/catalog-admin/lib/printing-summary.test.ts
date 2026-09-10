import { describe, expect, it } from "vitest";

import {
  printingKindLabel,
  printingSetLine,
  soldOnSummary,
} from "@/features/catalog-admin/lib/printing-summary";
import { makeAdminPrinting, makeAdminPrintingMarketplaceMapping } from "@/test/factories";

const kindLabels = {
  artVariants: { normal: "Normal", altart: "Alt art" },
  markers: { prerelease: "Prerelease", promo: "Promo" },
};

function basePrinting(overrides: Parameters<typeof makeAdminPrinting>[0] = {}) {
  return makeAdminPrinting({ artVariant: "normal", ...overrides });
}

describe("printingKindLabel", () => {
  it("calls a plain printing Base", () => {
    expect(printingKindLabel(basePrinting(), kindLabels)).toBe("Base");
  });

  it("names a signed printing", () => {
    expect(printingKindLabel(basePrinting({ isSigned: true }), kindLabels)).toBe("Signed");
  });

  it("names a signed and overnumbered printing Signature", () => {
    const printing = basePrinting({ isSigned: true, isOvernumbered: true });
    expect(printingKindLabel(printing, kindLabels)).toBe("Signature");
  });

  it("names an overnumbered printing", () => {
    expect(printingKindLabel(basePrinting({ isOvernumbered: true }), kindLabels)).toBe(
      "Overnumbered",
    );
  });

  it("appends the art variant and every marker", () => {
    const printing = basePrinting({
      artVariant: "altart",
      markerSlugs: ["prerelease", "promo"],
    });
    expect(printingKindLabel(printing, kindLabels)).toBe("Alt art · Prerelease · Promo");
  });

  it("falls back to the slug for an unknown marker", () => {
    const printing = basePrinting({ markerSlugs: ["launch-party"] });
    expect(printingKindLabel(printing, kindLabels)).toBe("launch-party");
  });
});

describe("printingSetLine", () => {
  it("joins set, rarity and finish", () => {
    const line = printingSetLine(basePrinting({ rarity: "rare", finish: "foil" }), {
      rarities: { rare: "Rare" },
      finishes: { foil: "Foil" },
    });
    expect(line).toBe("Origins · Rare · Foil");
  });
});

describe("soldOnSummary", () => {
  it("says nothing is linked when no mapping targets the printing", () => {
    expect(soldOnSummary("p-1", [])).toBe("Not linked to any marketplace");
  });

  it("lists each marketplace once", () => {
    const mappings = [
      makeAdminPrintingMarketplaceMapping({ targetPrintingId: "p-1", marketplace: "tcgplayer" }),
      makeAdminPrintingMarketplaceMapping({
        targetPrintingId: "p-1",
        marketplace: "tcgplayer",
        externalId: 2,
      }),
      makeAdminPrintingMarketplaceMapping({ targetPrintingId: "p-1", marketplace: "cardmarket" }),
      makeAdminPrintingMarketplaceMapping({ targetPrintingId: "p-2", marketplace: "cardtrader" }),
    ];
    expect(soldOnSummary("p-1", mappings)).toBe("Sold on Cardmarket · TCGplayer");
  });
});
