import { priceLookupFromMap } from "@openrift/shared/price-lookup";
import type { MetaDeckCardIndexResponse } from "@openrift/shared/types/api/meta";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let cardIndex: MetaDeckCardIndexResponse = { cards: [], decks: [] };
let printingsByCardId = new Map<string, { printingId: string; language: string }[]>();
let ownedByPrinting: Record<string, number> | undefined = {};
let lockedByPrinting: Record<string, number> = {};
let priceMap: Record<string, Record<string, number>> = {};
let requestedEnabled: boolean | undefined;
let catalogLoaded = true;

vi.mock("@/features/meta/lib/meta-queries", () => ({
  metaDeckCardsQueryOptions: () => ({ queryKey: ["deck-cards"] }),
}));
vi.mock("@/features/cards/lib/prices-queries", () => ({
  pricesQueryOptions: { queryKey: ["prices"] },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: string[] }) => ({
    data: options.queryKey[0] === "prices" ? priceLookupFromMap(priceMap) : cardIndex,
  }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCatalogOnDemand: () => ({
    catalog: catalogLoaded ? { printingsByCardId } : undefined,
    error: null,
  }),
}));
vi.mock("@/features/meta/hooks/use-buildable-count", () => ({
  useBuildableCount: (enabled: boolean) => {
    requestedEnabled = enabled;
    return {
      data:
        enabled && ownedByPrinting
          ? { buildable: ownedByPrinting, locked: lockedByPrinting }
          : undefined,
    };
  },
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["en"],
}));
vi.mock("@/stores/display-store", () => ({
  useDisplayStore: (select: (state: { marketplaceOrder: string[] }) => unknown) =>
    select({ marketplaceOrder: ["cardtrader"] }),
}));

import { useMetaDeckCosts } from "./use-meta-deck-costs";

describe("useMetaDeckCosts", () => {
  beforeEach(() => {
    requestedEnabled = undefined;
    catalogLoaded = true;
    lockedByPrinting = {};
    cardIndex = {
      cards: ["card-a", "card-b"],
      decks: [
        { deckId: "deck-1", entries: [0, 2], sideboard: [1, 1] },
        { deckId: "deck-2", entries: [1, 3], sideboard: [] },
      ],
    };
    printingsByCardId = new Map([
      [
        "card-a",
        [
          { printingId: "print-a1", language: "en" },
          { printingId: "print-a2", language: "de" },
        ],
      ],
      ["card-b", [{ printingId: "print-b1", language: "en" }]],
    ]);
    priceMap = {
      "print-a1": { cardtrader: 500 },
      "print-a2": { cardtrader: 100 },
      "print-b1": { cardtrader: 250 },
    };
    ownedByPrinting = {};
  });

  it("values each list at the cheapest printing in the reader's languages", () => {
    const { result } = renderHook(() =>
      useMetaDeckCosts(false, { enabled: true, withCollection: false }),
    );
    expect(result.current?.get("deck-1")).toEqual({
      needed: 2,
      owned: undefined,
      value: 10,
      toComplete: undefined,
      unpriced: 0,
      unpricedMissing: 0,
    });
  });

  it("adds the sideboard when asked", () => {
    const { result } = renderHook(() =>
      useMetaDeckCosts(true, { enabled: true, withCollection: false }),
    );
    expect(result.current?.get("deck-1")?.needed).toBe(3);
    expect(result.current?.get("deck-1")?.value).toBe(12.5);
  });

  it("costs the completion once the copies are in", () => {
    ownedByPrinting = { "print-a2": 1 };
    const { result } = renderHook(() =>
      useMetaDeckCosts(false, { enabled: true, withCollection: true }),
    );
    expect(result.current?.get("deck-1")).toEqual({
      needed: 2,
      owned: 1,
      value: 10,
      toComplete: 5,
      unpriced: 0,
      unpricedMissing: 0,
      locked: 0,
    });
  });

  it("leaves locked copies out of the completion price", () => {
    ownedByPrinting = {};
    lockedByPrinting = { "print-a2": 1 };
    const { result } = renderHook(() =>
      useMetaDeckCosts(false, { enabled: true, withCollection: true }),
    );
    expect(result.current?.get("deck-1")?.owned).toBe(0);
    expect(result.current?.get("deck-1")?.toComplete).toBe(5);
  });

  it("stays undefined until the copies arrive, so nothing reads as unowned early", () => {
    ownedByPrinting = undefined;
    const { result } = renderHook(() =>
      useMetaDeckCosts(false, { enabled: true, withCollection: true }),
    );
    expect(result.current).toBeUndefined();
  });

  it("leaves the copies collection unsubscribed without a collection", () => {
    renderHook(() => useMetaDeckCosts(false, { enabled: true, withCollection: false }));
    expect(requestedEnabled).toBe(false);
  });

  it("stays undefined while the catalogue is still loading", () => {
    catalogLoaded = false;
    const { result } = renderHook(() =>
      useMetaDeckCosts(false, { enabled: true, withCollection: false }),
    );
    expect(result.current).toBeUndefined();
  });

  it("stays undefined and leaves the copies unsubscribed while disabled, even with cached data", () => {
    const { result } = renderHook(() =>
      useMetaDeckCosts(false, { enabled: false, withCollection: true }),
    );
    expect(result.current).toBeUndefined();
    expect(requestedEnabled).toBe(false);
  });
});
