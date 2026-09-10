import { describe, expect, it } from "vitest";

import {
  buildCoverageLines,
  coverageSentence,
} from "@/features/catalog-admin/lib/marketplace-coverage-line";
import {
  makeStagedProduct,
  makeUnifiedMappingGroup,
  makeUnifiedMappingPrinting,
} from "@/test/factories";

const en = makeUnifiedMappingPrinting({ printingId: "p-en", language: "EN" });
const enFoil = makeUnifiedMappingPrinting({
  printingId: "p-en-foil",
  language: "EN",
  finish: "foil",
});

describe("buildCoverageLines", () => {
  it("counts linked printings per marketplace", () => {
    const group = makeUnifiedMappingGroup({
      printings: [en, enFoil],
      tcgplayer: {
        stagedProducts: [],
        assignedProducts: [makeStagedProduct()],
        assignments: [
          { externalId: 1, printingId: "p-en", finish: "normal", language: "EN" },
          { externalId: 1, printingId: "p-en-foil", finish: "foil", language: "EN" },
        ],
      },
      cardmarket: {
        stagedProducts: [makeStagedProduct({ externalId: 9 })],
        assignedProducts: [],
        assignments: [{ externalId: 2, printingId: "p-en", finish: "normal", language: "EN" }],
      },
    });

    expect(buildCoverageLines(group)).toEqual([
      { marketplace: "tcgplayer", label: "TCGplayer", linked: 2, total: 2 },
      { marketplace: "cardmarket", label: "Cardmarket", linked: 1, total: 2 },
      { marketplace: "cardtrader", label: "CardTrader", linked: 0, total: 2 },
    ]);
  });

  it("drops a marketplace that carries none of the card's printings", () => {
    const scOnly = makeUnifiedMappingPrinting({ printingId: "p-sc", language: "SC" });
    const lines = buildCoverageLines(makeUnifiedMappingGroup({ printings: [scOnly] }));
    expect(lines.map((line) => line.marketplace)).not.toContain("tcgplayer");
  });
});

describe("coverageSentence", () => {
  const lines = [
    { marketplace: "tcgplayer" as const, label: "TCGplayer", linked: 3, total: 3 },
    { marketplace: "cardmarket" as const, label: "Cardmarket", linked: 2, total: 4 },
  ];

  it("says printings once and appends the suggestion count", () => {
    expect(coverageSentence(lines, 1)).toBe(
      "TCGplayer 3 of 3 printings linked · Cardmarket 2 of 4 linked · 1 suggestion",
    );
  });

  it("pluralises several suggestions", () => {
    expect(coverageSentence(lines, 4)).toContain("4 suggestions");
  });

  it("omits the suggestion part when there are none", () => {
    expect(coverageSentence(lines, 0)).toBe(
      "TCGplayer 3 of 3 printings linked · Cardmarket 2 of 4 linked",
    );
  });

  it("says so when no marketplace carries the card", () => {
    expect(coverageSentence([], 0)).toBe("Nothing on sale for this card yet");
  });
});
