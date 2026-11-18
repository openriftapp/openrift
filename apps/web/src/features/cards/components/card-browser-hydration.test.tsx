// @vitest-environment jsdom
import { labelMapOf } from "@openrift/shared/enum-label";
import {
  makeCatalogCard,
  makeCatalogPrinting,
  makeCatalogReference,
} from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogKeys, pricesKeys } from "@/features/cards/lib/cards-query-keys";
import { completeCatalogEntry } from "@/features/cards/lib/catalog-queries";

const { search, loaderData, setSearch } = vi.hoisted(() => ({
  search: {} as { languages?: string[]; printingId?: string },
  loaderData: {
    firstRow: [],
    facets: {},
    availableLanguages: ["EN"],
    setLabels: undefined as unknown,
    counts: { totalCards: 40, filteredCount: 40 },
    filterCounts: null,
  },
  setSearch: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useSearch: () => search, useLoaderData: () => loaderData }),
  Link: ({ children }: { children?: ReactNode }) => <a href="/help">{children}</a>,
  createLink: (Component: unknown) => Component,
}));

vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterValues: () => ({
    filters: { languages: [], ownedFilter: [], ownedCountMin: null, ownedCountMax: null },
    sortBy: "id",
    sortDir: "asc",
    view: "cards",
    groupBy: "set",
    groupDir: "asc",
    hasActiveFilters: false,
    filterState: { search: "" },
  }),
  useFilterActions: () => ({ setSearch }),
}));
vi.mock("@/features/cards/hooks/use-card-data", () => ({
  useCardData: () => ({
    sortedCards: [],
    printingsByCardId: new Map(),
    priceRangeByCardId: undefined,
    totalUniqueCards: 7,
    filteredCount: 7,
    searchAlternatives: [],
  }),
  useCatalogFilterMeta: () => ({
    availableFilters: {},
    availableLanguages: [],
    filterCounts: undefined,
    setDisplayLabel: (slug: string) => slug,
  }),
}));
vi.mock("@/features/cards/lib/cards-facets", () => ({
  fromWireFacets: () => ({}),
  fromWireFilterCounts: () => ({}),
}));

vi.mock("@/features/cards/components/active-filters", () => ({ ActiveFilters: () => null }));
vi.mock("@/features/cards/components/compact-filter-bar", () => ({
  CompactFilterBar: () => null,
}));
vi.mock("@/features/cards/components/options-bar", () => ({
  DesktopOptionsBar: () => null,
  DisplayOptionsPopover: () => null,
  MobileFilterContent: () => null,
  MobileOptionsContent: () => null,
  MobileOptionsDrawer: () => null,
}));
vi.mock("@/features/cards/components/search-query-line", () => ({
  SearchQueryLine: () => null,
}));
vi.mock("@/features/cards/hooks/use-query-filter-options", () => ({
  useQueryFilterOptions: () => null,
}));
vi.mock("@/features/cards/hooks/use-search-vocabulary", () => ({
  useSearchVocabulary: () => ({ validation: {}, suggestions: {}, valueLabel: () => "" }),
}));

vi.mock("@/features/cards/components/card-grid", () => ({
  CardGrid: () => <div data-testid="live-grid" />,
}));
vi.mock("@/features/cards/components/card-table", () => ({ CardTable: () => null }));
vi.mock("@/features/cards/components/first-row-grid", () => ({
  FirstRowGrid: () => <div data-testid="first-row" />,
}));
vi.mock("@/features/cards/components/browser-card-cell", () => ({
  BrowserCardCell: () => null,
}));
vi.mock("@/features/cards/components/card-detail/card-detail-actions", () => ({
  CardDetailActions: () => null,
}));
vi.mock("@/features/cards/components/selection-detail-overlays", () => ({
  SelectionDetailOverlays: () => null,
}));
vi.mock("@/features/cards/components/selection-detail-pane", () => ({
  SelectionDetailPane: () => null,
}));
vi.mock("@/features/cards/components/table-count-actions", () => ({
  TableCountActions: () => null,
}));
vi.mock("@/features/collections/components/annotated-dispose-dialog", () => ({
  AnnotatedDisposeDialog: () => null,
}));
vi.mock("@/features/collections/components/quick-add-palette", () => ({
  QuickAddPalette: () => null,
}));
vi.mock("@/features/collections/components/variant-locations-popover-host", () => ({
  VariantLocationsPopoverHost: () => null,
}));
vi.mock("@/features/lists/components/wishlist-picker-host", () => ({
  WishlistPickerHost: () => null,
}));

vi.mock("@/features/cards/hooks/use-card-deep-link", () => ({ useCardDeepLink: vi.fn() }));
vi.mock("@/features/cards/hooks/use-card-thumbnail-display", () => ({
  useCardThumbnailDisplayWith: (prices: unknown) => ({ prices, favoriteMarketplace: "tcgplayer" }),
}));
vi.mock("@/features/cards/hooks/use-filter-counts-visible", () => ({
  useFilterCountsVisible: () => true,
}));
vi.mock("@/features/cards/hooks/use-grid-keyboard-nav", () => ({ useGridKeyboardNav: vi.fn() }));
vi.mock("@/features/cards/hooks/use-search-and-close-detail", () => ({
  useSearchAndCloseDetail: () => vi.fn(),
}));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => {},
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCount: () => ({ data: undefined }),
}));
vi.mock("@/features/collections/hooks/use-quick-add-actions", () => ({
  useQuickAddActions: () => ({}),
}));
vi.mock("@/features/collections/hooks/use-row-action-handlers", () => ({
  useRowActionHandlers: vi.fn(),
}));
vi.mock("@/features/groups/hooks/use-wish-entries", () => ({
  useWishEntries: () => ({ entriesForPrinting: () => [] }),
}));
vi.mock("@/hooks/use-command-palette", () => ({ useRegisterQuickAdd: vi.fn() }));
vi.mock("@/hooks/use-display-languages", () => ({ useDisplayLanguages: () => ["EN"] }));
vi.mock("@/hooks/use-enums", () => ({ useChannelRegistry: () => [] }));
vi.mock("@/hooks/use-seed-languages-from-prefs", () => ({
  useSeedLanguagesFromPrefs: vi.fn(),
}));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: null }) }));

import { CardsPage } from "./cards-page";

const { id: _cardId, ...card } = makeCatalogCard({ id: "card-1" });
const { printingId: _printingId, side: _side, ...printing } = makeCatalogPrinting({});
const CATALOG: CatalogResponse = {
  sets: [{ id: "set-1", slug: "RB1", name: "First Set", releases: {}, setType: "main" }],
  cards: { "card-1": card },
  printings: { p1: printing },
  ...makeCatalogReference(),
};

describe("cards page load", () => {
  beforeEach(() => {
    loaderData.setLabels = labelMapOf({});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("keeps the server-rendered search input, its focus and its text until the grid is live", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = (
      <QueryClientProvider client={client}>
        <CardsPage />
      </QueryClientProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(container.querySelector('[data-testid="first-row"]')).not.toBeNull();
    input.focus();
    input.value = "jinx";

    const recoverable: unknown[] = [];
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, page, {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });

    expect(recoverable).toEqual([]);
    expect(container.querySelector("input")).toBe(input);
    expect(container.querySelector('[data-testid="first-row"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="live-grid"]')).toBeNull();

    await act(async () => {
      client.setQueryData(catalogKeys.all, completeCatalogEntry(CATALOG));
      client.setQueryData(pricesKeys.all, { prices: {} });
    });

    await waitFor(() =>
      expect(container.querySelector('[data-testid="live-grid"]')).not.toBeNull(),
    );
    expect(container.querySelector('[data-testid="first-row"]')).toBeNull();
    expect(container.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("jinx");
    await waitFor(() => expect(setSearch).toHaveBeenCalledWith("jinx"));

    root?.unmount();
    container.remove();
  });
});
