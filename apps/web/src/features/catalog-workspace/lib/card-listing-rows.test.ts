import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import { productSuggestionKey } from "@openrift/shared/marketplace-suggestions";
import type {
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { buildCardListings } from "./card-listing-rows";

function printing(
  overrides: Partial<UnifiedMappingPrintingResponse> = {},
): UnifiedMappingPrintingResponse {
  return {
    printingId: "p-en",
    setId: "ogn",
    shortCode: "OGN-001",
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    finish: "normal",
    size: "standard",
    language: "EN",
    imageUrl: null,
    tcgExternalId: null,
    cmExternalId: null,
    ctExternalId: null,
    cnExternalId: null,
    ...overrides,
  };
}

function staged(overrides: Partial<StagedProductResponse> = {}): StagedProductResponse {
  return {
    externalId: 1,
    productName: "Product",
    finish: "normal",
    language: "EN",
    marketCents: 100,
    lowCents: null,
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    currency: "USD",
    recordedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function group(
  printings: UnifiedMappingPrintingResponse[],
  cardtrader: Partial<UnifiedMappingGroupResponse["cardtrader"]>,
): UnifiedMappingGroupResponse {
  const empty = { stagedProducts: [], assignedProducts: [], assignments: [] };
  return {
    cardId: "c-1",
    cardSlug: "c-1",
    cardName: "Jinx",
    superTypes: [],
    domains: [],
    energy: null,
    might: null,
    setId: "set-1",
    setName: "Set",
    primaryShortCode: "OGN-001",
    printings,
    tcgplayer: empty,
    cardmarket: empty,
    cardtrader: { ...empty, ...cardtrader },
    cardnexus: empty,
  };
}

function suggestions(
  entries: [StagedProductResponse, ProductSuggestion[]][],
): Map<string, ProductSuggestion[]> {
  return new Map(
    entries.map(([product, list]) => [
      productSuggestionKey("cardtrader", product.externalId, product.finish, product.language),
      list,
    ]),
  );
}

describe("buildCardListings", () => {
  const en = printing({ printingId: "p-en" });
  const zh = printing({ printingId: "p-zh", language: "ZH" });

  it("splits unassigned from assigned listings", () => {
    const open = staged({ externalId: 1 });
    const mapped = staged({ externalId: 2 });
    const result = buildCardListings(
      group([en], {
        stagedProducts: [open],
        assignedProducts: [mapped],
        assignments: [{ externalId: 2, finish: "normal", language: "EN", printingId: "p-en" }],
      }),
      new Map(),
    );
    expect(result.unassigned.map((row) => row.product.externalId)).toEqual([1]);
    expect(result.assigned.map((row) => row.product.externalId)).toEqual([2]);
    expect(result.assigned[0]?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-en"]);
  });

  it("picks the best-scored suggestion and grades its strength", () => {
    const strongRow = staged({ externalId: 1 });
    const possibleRow = staged({ externalId: 2 });
    const weakRow = staged({ externalId: 3 });
    const result = buildCardListings(
      group([en, zh], { stagedProducts: [strongRow, possibleRow, weakRow] }),
      suggestions([
        [
          strongRow,
          [
            { printingId: "p-zh", score: 40 },
            { printingId: "p-en", score: 200 },
          ],
        ],
        [possibleRow, [{ printingId: "p-en", score: 80 }]],
        [weakRow, [{ printingId: "p-en", score: 1, isWeak: true }]],
      ]),
    );
    const byId = new Map(result.unassigned.map((row) => [row.product.externalId, row]));
    expect(byId.get(1)?.suggestion).toMatchObject({
      printing: { printingId: "p-en" },
      strength: "strong",
    });
    expect(byId.get(2)?.suggestion?.strength).toBe("possible");
    expect(byId.get(3)?.suggestion?.strength).toBe("weak");
  });

  it("collects only strong suggestions of unassigned listings for Accept strong", () => {
    const strongRow = staged({ externalId: 1 });
    const possibleRow = staged({ externalId: 2 });
    const result = buildCardListings(
      group([en], { stagedProducts: [strongRow, possibleRow] }),
      suggestions([
        [strongRow, [{ printingId: "p-en", score: 200 }]],
        [possibleRow, [{ printingId: "p-en", score: 80 }]],
      ]),
    );
    expect(result.strongCount).toBe(1);
    expect(result.strong.cardtrader).toEqual([
      { externalId: 1, finish: "normal", language: "EN", printingId: "p-en" },
    ]);
  });

  it("drops suggestions that point at a printing outside the card", () => {
    const row = staged({ externalId: 1 });
    const result = buildCardListings(
      group([en], { stagedProducts: [row] }),
      suggestions([[row, [{ printingId: "elsewhere", score: 500 }]]]),
    );
    expect(result.unassigned[0]?.suggestion).toBeNull();
    expect(result.strongCount).toBe(0);
  });

  it("shows no listing without products", () => {
    const result = buildCardListings(group([en], {}), new Map());
    expect(result.unassigned).toEqual([]);
    expect(result.assigned).toEqual([]);
  });
});
