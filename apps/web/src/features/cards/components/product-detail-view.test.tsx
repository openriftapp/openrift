import type { ProductDetailResponse } from "@openrift/shared/contracts/products";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { Printing } from "@openrift/shared/types/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { completeCatalogEntry } from "@/features/cards/lib/catalog-queries";
import { productDetailQueryOptions } from "@/features/cards/lib/products-queries";
import { useSelectionStore } from "@/stores/selection-store";
import { stubPrinting } from "@/test/factories";

import { ProductDetailView } from "./product-detail-view";

const hydration = vi.hoisted(() => ({ hydrated: false }));
const { fetchCatalog, captureHandledError } = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  captureHandledError: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({}),
}));
vi.mock("@/features/cards/components/card-browser-layout", () => ({
  CardBrowserLayout: ({ gridSlot }: { gridSlot: ReactNode }) => <div>{gridSlot}</div>,
}));
vi.mock("@/features/cards/components/product-add-dialog", () => ({
  ProductAddDialog: () => null,
}));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => hydration.hydrated }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { finishes: { foil: "Foil" }, artVariants: {}, cardSizes: {} } }),
  useChannelRegistry: () => [],
}));
vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => <span>{code}</span>,
}));

vi.mock("@/features/cards/hooks/use-cards", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useCards: () => {
    // oxlint-disable-next-line typescript/only-throw-error -- a thrown promise is how a hook suspends
    throw new Promise(() => {});
  },
}));
vi.mock("@/features/cards/lib/catalog-queries", async (importOriginal) => {
  const actual = await importOriginal<{ catalogQueryOptions: object }>();
  return {
    ...actual,
    catalogQueryOptions: { ...actual.catalogQueryOptions, queryFn: fetchCatalog, retry: false },
  };
});
vi.mock("@/lib/report-error", () => ({ captureHandledError }));
vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({ get: () => undefined, has: () => false }),
}));
vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplay: () => ({ prices: {}, favoriteMarketplace: "tcgplayer" }),
}));
vi.mock("@/hooks/use-keyword-reverse-map", () => ({ useKeywordReverseMap: () => new Map() }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCount: () => ({ data: undefined }),
}));
vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterValues: () => ({
    filters: { languages: [], ownedFilter: [], ownedCountMin: null, ownedCountMax: null },
    sortBy: "id",
    sortDir: "asc",
    groupBy: "none",
    hasActiveFilters: false,
  }),
  useFilterActions: () => ({ setSearch: vi.fn() }),
}));
vi.mock("@/features/cards/hooks/use-card-data", () => ({
  useCardData: ({ allPrintings }: { allPrintings: Printing[] }) => ({
    sortedCards: allPrintings,
    totalUniqueCards: allPrintings.length,
    filteredCount: allPrintings.length,
  }),
}));
vi.mock("@/features/cards/components/card-browser-filter-scaffold", () => ({
  BrowserToolbar: () => null,
  CardBrowserFilterProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/cards/components/card-viewer", () => ({
  CardViewer: ({
    items,
    rightPane,
    children,
  }: {
    items: { id: string; printing: Printing }[];
    rightPane: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <ul aria-label="grid">
        {items.map((item) => (
          <li key={item.id}>{item.printing.card.name}</li>
        ))}
      </ul>
      {rightPane}
      {children}
    </div>
  ),
}));
vi.mock("@/features/cards/components/selection-detail-pane", () => ({
  SelectionDetailPane: ({ printingsByCardId }: { printingsByCardId: Map<string, Printing[]> }) => (
    <p>pane lists {printingsByCardId.get("jinx")?.length ?? 0} printings</p>
  ),
}));
vi.mock("@/features/cards/components/selection-detail-overlays", () => ({
  SelectionDetailOverlays: () => null,
}));

const SET_ID = "00000000-0000-0000-0000-00000000set1";

function wireResponse(): ProductDetailResponse {
  const printing = stubPrinting({
    printingId: "p-foil",
    cardId: "jinx",
    shortCode: "OGN-001",
    publicCode: "OGN-001/298",
    finish: "foil",
    language: "EN",
    card: { name: "Jinx, Rebel", slug: "jinx-rebel" },
  });
  const { setSlug: _slug, setReleased: _released, card, ...wire } = printing;
  return {
    product: {
      id: "product-1",
      slug: "jinx-starter",
      name: "Jinx Starter",
      description: null,
      set: null,
      printingCount: 1,
      cardTotal: 2,
      coverCards: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    contents: [{ printingId: "p-foil", quantity: 2 }],
    cards: { jinx: card } as unknown as ProductDetailResponse["cards"],
    printings: [{ ...wire, setId: SET_ID }] as unknown as ProductDetailResponse["printings"],
    sets: [
      {
        id: SET_ID,
        slug: "OGN",
        name: "Origins",
        releases: { EN: { releasedAt: "2025-01-01", precision: "day" } },
      },
    ] as unknown as ProductDetailResponse["sets"],
    variantSiblings: {
      jinx: {
        languages: ["EN", "FR"],
        rarities: ["common"],
        finishes: ["foil", "normal"],
        markerSlugs: [[]],
        signed: [false],
        otherSides: [],
      },
    },
  };
}

function catalogResponse(): CatalogResponse {
  const { cards, printings, sets } = wireResponse();
  const [foil] = printings as unknown as Record<string, unknown>[];
  const { printingId: _id, side: _side, ...value } = foil ?? {};
  const face = { ...value, markers: [], distributionChannels: [] };
  return {
    sets,
    cards,
    printings: {
      "p-foil": face,
      "p-normal": { ...face, faceId: "p-normal", finish: "normal" },
    },
    markers: [],
    distributionChannels: [],
  } as unknown as CatalogResponse;
}

function renderPage(client: QueryClient) {
  const select = productDetailQueryOptions("jinx-starter").select;
  if (!select) {
    throw new Error("productDetailQueryOptions has no select");
  }
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<p>suspended</p>}>
        <ProductDetailView data={select(wireResponse())} search={{}} />
      </Suspense>
    </QueryClientProvider>,
  );
}

describe("ProductDetailView", () => {
  it("renders its contents and their labels from the product payload without the catalogue", () => {
    hydration.hydrated = false;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderPage(client);

    expect(screen.queryByText("suspended")).toBeNull();
    const line = screen.getByText("OGN-001/298").closest("div")?.textContent;
    expect(line).toContain("EN");
    expect(line).toContain("Foil");
    expect(line).toMatch(/ · ×2$/u);
    expect(client.getQueryCache().find({ queryKey: catalogKeys.all, exact: true })).toBeUndefined();
  });

  describe("after hydration", () => {
    beforeEach(() => {
      hydration.hydrated = true;
      fetchCatalog.mockReset();
      captureHandledError.mockReset();
      useSelectionStore.getState().closeDetail();
    });
    afterEach(() => {
      useSelectionStore.getState().closeDetail();
    });

    function openDetail() {
      const select = productDetailQueryOptions("jinx-starter").select;
      const printing = select?.(wireResponse()).printings[0];
      if (!printing) {
        throw new Error("fixture has no printing");
      }
      act(() => {
        useSelectionStore
          .getState()
          .selectCard(printing, [{ id: printing.printingId, printing }], "printing");
      });
    }

    it("loads the catalogue on the first opened card only, never before", async () => {
      fetchCatalog.mockResolvedValue(completeCatalogEntry(catalogResponse()));
      renderPage(new QueryClient());

      expect(screen.getByRole("list", { name: "grid" }).textContent).toBe("Jinx, Rebel");
      expect(screen.getByText("pane lists 1 printings")).toBeTruthy();
      expect(fetchCatalog).not.toHaveBeenCalled();

      openDetail();
      expect(await screen.findByText("pane lists 2 printings")).toBeTruthy();
      expect(fetchCatalog).toHaveBeenCalledTimes(1);

      act(() => useSelectionStore.getState().closeDetail());
      openDetail();
      expect(screen.getByText("pane lists 2 printings")).toBeTruthy();
      expect(fetchCatalog).toHaveBeenCalledTimes(1);
    });

    it("keeps the product's printings in the pane and reports a failed catalogue load", async () => {
      const failure = new Error("catalogue unavailable");
      fetchCatalog.mockRejectedValue(failure);
      renderPage(new QueryClient());

      openDetail();

      await waitFor(() =>
        expect(captureHandledError).toHaveBeenCalledWith(failure, expect.anything()),
      );
      expect(screen.getByText("pane lists 1 printings")).toBeTruthy();
      expect(screen.getByRole("list", { name: "grid" }).textContent).toBe("Jinx, Rebel");
    });
  });
});
