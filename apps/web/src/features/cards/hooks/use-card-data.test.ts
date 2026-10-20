import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { sideKey } from "@openrift/shared/printing-side";
import type { CardFilters } from "@openrift/shared/types/search";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupInfo } from "@/lib/card-group-types";
import { resetIdCounter, stubPrinting } from "@/test/factories";

const TEST_ORDERS = {
  rarities: ["common", "uncommon", "rare", "epic"],
  finishes: ["normal", "foil"],
  domains: ["fury"],
  cardTypes: ["unit"],
  superTypes: [] as string[],
  artVariants: ["normal", "altart"],
  distributionChannels: [] as string[],
  languages: ["EN"],
};

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: TEST_ORDERS, labels: {} }),
}));

const { useCardData } = await import("./use-card-data");

beforeEach(() => {
  resetIdCounter();
});

const SETS: GroupInfo[] = [{ id: "set-1", slug: "rb1", name: "RB1", setType: "main" }];

function emptyFilters(): CardFilters {
  return { ...EMPTY_CARD_FILTERS };
}

function baseParams() {
  return {
    allPrintings: [],
    sets: SETS,
    filters: emptyFilters(),
    ownedFilter: [] as ("none" | "partial" | "full" | "extra")[],
    sortBy: "name" as const,
    sortDir: "asc" as const,
    view: "printings" as const,
    ownedCountByPrinting: undefined as Record<string, number> | undefined,
    favoriteMarketplace: "tcgplayer" as const,
    prices: EMPTY_PRICE_LOOKUP,
  };
}

describe("useCardData", () => {
  it("narrows non-owned facet counts to the selected owned bucket", () => {
    const ownedCommon = stubPrinting({ rarity: "common" });
    const unownedRare = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [ownedCommon, unownedRare],
      ownedFilter: ["partial", "full", "extra"] as const,
      ownedCountByPrinting: { [ownedCommon.printingId]: 1, [unownedRare.printingId]: 0 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.filterCounts.rarities.get("common")).toBe(1);
    expect(result.current.filterCounts.rarities.get("rare")).toBeUndefined();
  });

  it("skips the meta computation when metaEnabled is false, keeping grid outputs", () => {
    const a = stubPrinting({ rarity: "common" });
    const b = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [a, b],
      metaEnabled: false,
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards).toHaveLength(2);
    expect(result.current.filteredCount).toBe(2);
    expect(result.current.filterCounts.rarities.size).toBe(0);
    expect(result.current.availableFilters.rarities).toHaveLength(0);
  });

  it("skips only the counts pass when countsEnabled is false, keeping availableFilters", () => {
    const a = stubPrinting({ rarity: "common" });
    const b = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [a, b],
      countsEnabled: false,
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards).toHaveLength(2);
    expect(result.current.filterCounts.rarities.size).toBe(0);
    expect(result.current.availableFilters.rarities.length).toBeGreaterThan(0);
  });

  it("leaves facet counts unchanged when the owned filter is empty", () => {
    const a = stubPrinting({ rarity: "common" });
    const b = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [a, b],
      ownedFilter: [],
      ownedCountByPrinting: { [a.printingId]: 1, [b.printingId]: 0 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.filterCounts.rarities.get("common")).toBe(1);
    expect(result.current.filterCounts.rarities.get("rare")).toBe(1);
  });

  it("filters by the 'none' bucket — only unowned cards survive", () => {
    const owned = stubPrinting({ rarity: "common" });
    const unowned = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [owned, unowned],
      ownedFilter: ["none"] as const,
      ownedCountByPrinting: { [owned.printingId]: 2, [unowned.printingId]: 0 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards).toHaveLength(1);
    expect(result.current.sortedCards[0]?.printingId).toBe(unowned.printingId);
  });

  it("filters by 'full' — only cards with exactly the playset size match", () => {
    const full = stubPrinting({ rarity: "common" });
    const partial = stubPrinting({ rarity: "uncommon" });
    const extra = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [full, partial, extra],
      ownedFilter: ["full"] as const,
      ownedCountByPrinting: {
        [full.printingId]: 3,
        [partial.printingId]: 1,
        [extra.printingId]: 5,
      },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId)).toEqual([full.printingId]);
  });

  it("filters by 'partial' — only cards above zero but below a full playset match", () => {
    const empty = stubPrinting({ rarity: "common" });
    const partial = stubPrinting({ rarity: "uncommon" });
    const full = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [empty, partial, full],
      ownedFilter: ["partial"] as const,
      ownedCountByPrinting: {
        [empty.printingId]: 0,
        [partial.printingId]: 1,
        [full.printingId]: 3,
      },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId)).toEqual([partial.printingId]);
  });

  it("filters by 'extra' — only cards beyond a full playset match", () => {
    const full = stubPrinting({ rarity: "common" });
    const extra = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [full, extra],
      ownedFilter: ["extra"] as const,
      ownedCountByPrinting: { [full.printingId]: 3, [extra.printingId]: 7 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId)).toEqual([extra.printingId]);
  });

  it("OR's multiple selected buckets", () => {
    const empty = stubPrinting({ rarity: "common" });
    const partial = stubPrinting({ rarity: "uncommon" });
    const extra = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [empty, partial, extra],
      ownedFilter: ["none", "extra"] as const,
      ownedCountByPrinting: {
        [empty.printingId]: 0,
        [partial.printingId]: 1,
        [extra.printingId]: 5,
      },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId).toSorted()).toEqual(
      [empty.printingId, extra.printingId].toSorted(),
    );
  });

  it("filters by a copies-owned range (min..max inclusive)", () => {
    const one = stubPrinting({ rarity: "common" });
    const three = stubPrinting({ rarity: "uncommon" });
    const five = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [one, three, five],
      ownedCountMin: 2,
      ownedCountMax: 4,
      ownedCountByPrinting: { [one.printingId]: 1, [three.printingId]: 3, [five.printingId]: 5 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId)).toEqual([three.printingId]);
  });

  it("treats an open-ended copies-owned min as 'that many and up'", () => {
    const two = stubPrinting({ rarity: "common" });
    const ten = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [two, ten],
      ownedCountMin: 3,
      ownedCountMax: null,
      ownedCountByPrinting: { [two.printingId]: 2, [ten.printingId]: 10 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId)).toEqual([ten.printingId]);
  });

  it("narrows non-owned facet counts to the copies-owned range", () => {
    const inRange = stubPrinting({ rarity: "common" });
    const outOfRange = stubPrinting({ rarity: "rare" });

    const params = {
      ...baseParams(),
      allPrintings: [inRange, outOfRange],
      ownedCountMin: 2,
      ownedCountMax: null,
      ownedCountByPrinting: { [inRange.printingId]: 4, [outOfRange.printingId]: 1 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.filterCounts.rarities.get("common")).toBe(1);
    expect(result.current.filterCounts.rarities.get("rare")).toBeUndefined();
  });

  it("buckets each printing on its own owned count in printings view", () => {
    const cardId = "shared-card";
    const ownedVariant = stubPrinting({ cardId, shortCode: "A-001" });
    const unownedVariant = stubPrinting({ cardId, shortCode: "B-001" });

    const params = {
      ...baseParams(),
      allPrintings: [ownedVariant, unownedVariant],
      ownedFilter: ["partial", "full", "extra"] as const,
      ownedCountByPrinting: { [ownedVariant.printingId]: 1, [unownedVariant.printingId]: 0 },
    };

    const { result } = renderHook(() => useCardData(params));

    expect(result.current.sortedCards.map((p) => p.printingId)).toEqual([ownedVariant.printingId]);
  });

  it("dedupes to one printing per cardId in cards view by default", () => {
    const cardId = "card-shared";
    const ognPrinting = stubPrinting({ cardId, shortCode: "OGN-001" });
    const sfdPrinting = stubPrinting({ cardId, shortCode: "SFD-001" });

    const { result } = renderHook(() =>
      useCardData({ ...baseParams(), allPrintings: [ognPrinting, sfdPrinting], view: "cards" }),
    );

    expect(result.current.sortedCards).toHaveLength(1);
  });

  it("dedupes per (cardId, setId) when grouping by set in cards view", () => {
    const cardId = "card-shared";
    const ognSetId = "set-ogn";
    const sfdSetId = "set-sfd";
    const ognNormal = stubPrinting({ cardId, setId: ognSetId, shortCode: "OGN-001" });
    const ognAltart = stubPrinting({ cardId, setId: ognSetId, shortCode: "OGN-001-alt" });
    const sfdNormal = stubPrinting({ cardId, setId: sfdSetId, shortCode: "SFD-001" });

    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        allPrintings: [ognNormal, ognAltart, sfdNormal],
        view: "cards",
        groupBy: "set",
      }),
    );

    expect(result.current.sortedCards).toHaveLength(2);
    expect(result.current.sortedCards.map((p) => p.setId).toSorted()).toEqual([ognSetId, sfdSetId]);
  });

  it("counts unique cards (not per-set tiles) for filteredCount in cards+set mode", () => {
    const reprintedCardId = "card-reprinted";
    const uniqueCardId = "card-unique";
    const ognSetId = "set-ogn";
    const sfdSetId = "set-sfd";
    const reprintedOgn = stubPrinting({ cardId: reprintedCardId, setId: ognSetId });
    const reprintedSfd = stubPrinting({ cardId: reprintedCardId, setId: sfdSetId });
    const uniqueOgn = stubPrinting({ cardId: uniqueCardId, setId: ognSetId });

    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        allPrintings: [reprintedOgn, reprintedSfd, uniqueOgn],
        view: "cards",
        groupBy: "set",
      }),
    );

    expect(result.current.sortedCards).toHaveLength(3);
    expect(result.current.totalUniqueCards).toBe(2);
    expect(result.current.filteredCount).toBe(2);
  });

  it("attributes owned counts per set, not per card, when grouping by set in cards view", () => {
    const cardId = "daring-poro";
    const ognSetId = "set-ogn";
    const unlSetId = "set-unl";
    const ognNormal = stubPrinting({ cardId, setId: ognSetId, shortCode: "OGN-001" });
    const ognAltart = stubPrinting({ cardId, setId: ognSetId, shortCode: "OGN-001-alt" });
    const unlNormal = stubPrinting({ cardId, setId: unlSetId, shortCode: "UNL-001" });

    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        allPrintings: [ognNormal, ognAltart, unlNormal],
        view: "cards",
        groupBy: "set",
        ownedCountByPrinting: {
          [ognNormal.printingId]: 5,
          [ognAltart.printingId]: 1,
          [unlNormal.printingId]: 0,
        },
      }),
    );

    const ownedCounts = result.current.ownedCounts;
    const ognTile = result.current.sortedCards.find((printing) => printing.setId === ognSetId);
    const unlTile = result.current.sortedCards.find((printing) => printing.setId === unlSetId);

    expect(ognTile).toBeDefined();
    expect(unlTile).toBeDefined();
    expect(ognTile && ownedCounts?.get(ognTile.printingId)).toBe(6);
    expect(unlTile && ownedCounts?.get(unlTile.printingId)).toBeUndefined();
  });

  it("attributes owned counts per rarity when grouping by rarity in cards view", () => {
    const cardId = "card-shared";
    const common = stubPrinting({ cardId, rarity: "common", shortCode: "A-001" });
    const rare = stubPrinting({ cardId, rarity: "rare", shortCode: "B-001" });

    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        allPrintings: [common, rare],
        view: "cards",
        groupBy: "rarity",
        ownedCountByPrinting: { [common.printingId]: 4, [rare.printingId]: 0 },
      }),
    );

    const ownedCounts = result.current.ownedCounts;
    const commonTile = result.current.sortedCards.find((printing) => printing.rarity === "common");
    const rareTile = result.current.sortedCards.find((printing) => printing.rarity === "rare");

    expect(commonTile).toBeDefined();
    expect(rareTile).toBeDefined();
    expect(commonTile && ownedCounts?.get(commonTile.printingId)).toBe(4);
    expect(rareTile && ownedCounts?.get(rareTile.printingId)).toBeUndefined();
  });

  it("sums owned counts across all printings on the single tile in cards view (no set grouping)", () => {
    const cardId = "card-shared";
    const ognPrinting = stubPrinting({ cardId, setId: "set-ogn", shortCode: "OGN-001" });
    const unlPrinting = stubPrinting({ cardId, setId: "set-unl", shortCode: "UNL-001" });

    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        allPrintings: [ognPrinting, unlPrinting],
        view: "cards",
        ownedCountByPrinting: { [ognPrinting.printingId]: 2, [unlPrinting.printingId]: 1 },
      }),
    );

    expect(result.current.sortedCards).toHaveLength(1);
    const tile = result.current.sortedCards[0];
    expect(tile && result.current.ownedCounts?.get(tile.printingId)).toBe(3);
  });

  it("filteredCount equals printing count in printings view", () => {
    const a = stubPrinting();
    const b = stubPrinting();

    const { result } = renderHook(() =>
      useCardData({ ...baseParams(), allPrintings: [a, b], view: "printings" }),
    );

    expect(result.current.filteredCount).toBe(2);
    expect(result.current.totalUniqueCards).toBe(2);
  });
});

describe("useCardData owned counts on double-sided printings", () => {
  const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird", shortCode: "T-001" });
  const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold", shortCode: "T-005" });
  const soloGold = stubPrinting({ printingId: "solo", cardId: "gold", shortCode: "T-006" });

  it("gives each side of a printing the printing's copies in printings view", () => {
    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        allPrintings: [bird, gold],
        ownedCountByPrinting: { pair: 2 },
      }),
    );

    expect(result.current.ownedCounts?.get("pair")).toBe(2);
    expect(result.current.ownedCounts?.get("pair:2")).toBe(2);
  });

  it("adds a pair's copies to each of its cards in cards view", () => {
    const { result } = renderHook(() =>
      useCardData({
        ...baseParams(),
        view: "cards",
        allPrintings: [bird, gold, soloGold],
        ownedCountByPrinting: { pair: 2, solo: 1 },
      }),
    );
    const tiles = new Map(result.current.sortedCards.map((p) => [p.cardId, sideKey(p)]));

    expect(result.current.ownedCounts?.get(tiles.get("bird")!)).toBe(2);
    expect(result.current.ownedCounts?.get(tiles.get("gold")!)).toBe(3);
  });
});
