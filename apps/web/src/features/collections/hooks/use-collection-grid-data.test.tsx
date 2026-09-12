import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import type { Printing } from "@openrift/shared/types/catalog";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { stubPrinting } from "@/test/factories";

const SORTED: Printing[] = [stubPrinting(), stubPrinting()];

vi.mock("@/features/cards/hooks/use-card-data", () => ({
  useCardData: () => ({
    availableFilters: null,
    availableLanguages: [],
    filterCounts: null,
    sortedCards: [],
    printingsByCardId: new Map(),
    priceRangeByCardId: new Map(),
    totalUniqueCards: 0,
    setDisplayLabel: {},
  }),
}));
vi.mock("@/features/cards/hooks/use-filter-counts-visible", () => ({
  useFilterCountsVisible: () => true,
}));
vi.mock("@/features/collections/hooks/use-collection-card-data", () => ({
  useCollectionCardData: () => ({
    availableFilters: null,
    availableLanguages: [],
    filterCounts: null,
    sortedCards: SORTED,
    selectableCopyIds: [],
    printingsByCardId: new Map(),
    stacks: [],
    totalCopies: SORTED.length,
    collectionIdByCopyId: new Map(),
    stackByPrintingId: new Map(),
    totalUniqueCards: SORTED.length,
    ownedCountMax: 0,
    setDisplayLabel: {},
    isReady: true,
  }),
}));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsMap: () => new Map(),
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCount: () => ({ data: undefined }),
}));
vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroupsList: () => ({ data: undefined }),
  useGroupBoxWants: () => ({ wantsCard: () => false, fulfillable: () => 0 }),
}));
vi.mock("@/hooks/use-enums", () => ({ useChannelRegistry: () => ({}) }));
vi.mock("@/hooks/use-keyword-reverse-map", () => ({ useKeywordReverseMap: () => new Map() }));
vi.mock("@/lib/auth-session", () => ({ useSession: () => ({ data: undefined }) }));

const { useCollectionGridData } = await import("./use-collection-grid-data");

function params() {
  return {
    collectionId: undefined,
    filters: {
      ...EMPTY_CARD_FILTERS,
      ownedFilter: [],
      ownedCountMin: null,
      ownedCountMax: null,
    } as unknown as ReturnType<typeof useFilterValues>["filters"],
    sortBy: "name" as const,
    sortDir: "asc" as const,
    view: "printings" as const,
    groupBy: "none" as const,
    showLibrary: false,
    wantedOnly: false,
    allPrintings: [] as Printing[],
    sets: [],
    catalogAllPrintingsByCardId: new Map<string, Printing[]>(),
    favoriteMarketplace: "tcgplayer" as const,
    prices: EMPTY_PRICE_LOOKUP,
  };
}

describe("useCollectionGridData deferred grid", () => {
  it("mounts with an empty stale grid and fills it in the deferred render", async () => {
    const renders: { stale: boolean; cards: Printing[] }[] = [];
    const { result } = renderHook(() => {
      const data = useCollectionGridData(params());
      renders.push({ stale: data.isGridStale, cards: data.deferredSortedCards });
      return data;
    });

    expect(renders[0]).toEqual({ stale: true, cards: [] });
    await waitFor(() => expect(result.current.deferredSortedCards).toBe(SORTED));
    expect(result.current.isGridStale).toBe(false);
    expect(result.current.sortedCards).toBe(SORTED);
  });
});
