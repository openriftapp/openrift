import { productSuggestionKey } from "@openrift/shared/marketplace-suggestions";
import type {
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { unmatchedListingGroups } from "./card-listing-groups";

const PRINTING = {
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
} as UnifiedMappingPrintingResponse;

function staged(overrides: Partial<StagedProductResponse>): StagedProductResponse {
  return {
    externalId: 1,
    productName: "Jinx",
    finish: "foil",
    language: "FR",
    marketCents: 100,
    lowCents: null,
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    currency: "EUR",
    recordedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function group(
  cardtrader: StagedProductResponse[],
  cardnexus: StagedProductResponse[],
): UnifiedMappingGroupResponse {
  const empty = { stagedProducts: [], assignedProducts: [], assignments: [] };
  return {
    cardId: "c-1",
    cardSlug: "jinx",
    cardName: "Jinx",
    superTypes: [],
    domains: [],
    energy: null,
    might: null,
    setId: "set-1",
    setName: "Set",
    primaryShortCode: "OGN-001",
    printings: [PRINTING],
    tcgplayer: empty,
    cardmarket: empty,
    cardtrader: { ...empty, stagedProducts: cardtrader },
    cardnexus: { ...empty, stagedProducts: cardnexus },
  };
}

describe("unmatchedListingGroups", () => {
  it("groups a card's unmatched listings by the variants of its queue item", () => {
    const groups = unmatchedListingGroups(
      group(
        [staged({ externalId: 1 }), staged({ externalId: 2, language: "SC", finish: "normal" })],
        [staged({ externalId: 3 })],
      ),
      new Map(),
      [
        { language: "FR", finish: "foil", count: 2 },
        { language: "SC", finish: "normal", count: 1 },
      ],
    );
    expect(
      groups.map((entry) => [
        entry.key,
        entry.rows.map((row) => `${row.marketplace}:${row.product.externalId}`),
      ]),
    ).toEqual([
      ["FR|foil", ["cardtrader:1", "cardnexus:3"]],
      ["SC|normal", ["cardtrader:2"]],
    ]);
  });

  it("leaves out listings with a suggested printing and variants not in the queue item", () => {
    const suggested = staged({ externalId: 1 });
    const groups = unmatchedListingGroups(
      group([suggested, staged({ externalId: 2 }), staged({ externalId: 4, language: "KR" })], []),
      new Map([
        [productSuggestionKey("cardtrader", 1, "foil", "FR"), [{ printingId: "p-en", score: 60 }]],
        [
          productSuggestionKey("cardtrader", 2, "foil", "FR"),
          [{ printingId: "p-en", score: 60, isWeak: true }],
        ],
      ]),
      [{ language: "FR", finish: "foil", count: 1 }],
    );
    expect(groups.flatMap((entry) => entry.rows.map((row) => row.product.externalId))).toEqual([2]);
  });
});
