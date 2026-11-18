// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pricesKeys } from "@/features/cards/lib/cards-query-keys";
import { stubDeckBuilderCard, stubPrinting } from "@/test/factories";

const printing = stubPrinting({ printingId: "print-a", cardId: "card-a" });
let catalogLoaded = true;
let copiesLoaded = true;
let requestedCopies: boolean | undefined;

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCardsOnDemand: (enabled: boolean) =>
    enabled && catalogLoaded ? { allPrintings: [printing] } : undefined,
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  countExcludedAsAvailable: (counts: unknown) => counts,
  useDeckBuildingCounts: (enabled: boolean) => {
    requestedCopies = enabled;
    return {
      data:
        enabled && copiesLoaded
          ? {
              available: { "print-a": 2 },
              locked: {},
              lockedLoaned: {},
              lockedReserved: {},
              lockedExcluded: {},
            }
          : undefined,
    };
  },
}));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useBorrowedCounts: () => ({ data: undefined }),
}));
vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  useIncomingTradeCounts: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));

import { useViewerDeckOwnership } from "./use-viewer-deck-ownership";

const cards = [stubDeckBuilderCard({ cardId: "card-a", quantity: 3 })];

function seededClient(withPrices = true): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (withPrices) {
    client.setQueryData(pricesKeys.all, { prices: { "print-a": { tcgplayer: 150 } } });
  }
  return client;
}

function renderOwnership(
  options: { enabled?: boolean; isLoggedIn?: boolean } = {},
  client = seededClient(),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useViewerDeckOwnership(cards, {
        enabled: options.enabled ?? true,
        isLoggedIn: options.isLoggedIn ?? true,
        marketplace: "tcgplayer",
      }),
    { wrapper },
  ).result;
}

describe("useViewerDeckOwnership", () => {
  beforeEach(() => {
    catalogLoaded = true;
    copiesLoaded = true;
    requestedCopies = undefined;
    vi.stubGlobal("fetch", () => new Promise(() => {}));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts the viewer's copies against the deck", () => {
    const result = renderOwnership();
    expect(result.current?.totalNeeded).toBe(3);
    expect(result.current?.totalOwned).toBe(2);
    expect(result.current?.missingCount).toBe(1);
  });

  it("prices the deck for a logged-out viewer without reading copies", () => {
    const result = renderOwnership({ isLoggedIn: false });
    expect(result.current?.totalOwned).toBe(0);
    expect(result.current?.deckValue).toBe(4.5);
    expect(requestedCopies).toBe(false);
  });

  it("stays undefined until the copies arrive, so nothing reads as unowned early", () => {
    copiesLoaded = false;
    expect(renderOwnership().current).toBeUndefined();
  });

  it("stays undefined while the catalogue is loading", () => {
    catalogLoaded = false;
    expect(renderOwnership().current).toBeUndefined();
  });

  it("stays undefined while the prices are loading", () => {
    expect(renderOwnership({}, seededClient(false)).current).toBeUndefined();
  });

  it("stays undefined and leaves the copies unsubscribed while disabled", () => {
    expect(renderOwnership({ enabled: false }).current).toBeUndefined();
    expect(requestedCopies).toBe(false);
  });
});
