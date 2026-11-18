import {
  makeCatalogCard,
  makeCatalogPrinting,
  makeCatalogReference,
} from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { enrichCatalog } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import { useOwnershipBandSources } from "@/features/decks/hooks/use-ownership-band-sources";
import { useViewerDeckOwnership } from "@/features/decks/hooks/use-viewer-deck-ownership";
import { initQueryOptions } from "@/lib/init-queries";
import { stubDeckBuilderCard } from "@/test/factories";
import { stubInitResponse } from "@/test/init-fixtures";

const { id: _cardId, ...card } = makeCatalogCard({ id: "card-1" });
const { printingId: _printingId, side: _side, ...printing } = makeCatalogPrinting({});
const CATALOG: CatalogResponse = {
  sets: [{ id: "set-1", slug: "RB1", name: "First Set", releases: {}, setType: "main" }],
  cards: { "card-1": card },
  printings: { p1: printing },
  ...makeCatalogReference(),
};
const DECK = [stubDeckBuilderCard({ cardId: "card-1", quantity: 2 })];

function seededClient(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(initQueryOptions.queryKey, stubInitResponse());
  client.setQueryData(pricesQueryOptions.queryKey, {
    prices: { p1: { tcgplayer: 120 } },
    currencies: { tcgplayer: "USD", cardmarket: "EUR", cardtrader: "EUR", cardnexus: "EUR" },
  });
  return client;
}

function renderOverlays(client: QueryClient, enabled: boolean): string {
  function Overlays() {
    const ownership = useViewerDeckOwnership(DECK, {
      enabled,
      isLoggedIn: false,
      marketplace: "tcgplayer",
    });
    const bands = useOwnershipBandSources(DECK, { enabled });
    return createElement("p", null, `${ownership === undefined}:${bands === undefined}`);
  }
  return renderToString(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        CatalogSubsetContext,
        { value: enrichCatalog(CATALOG) },
        createElement(Overlays),
      ),
    ),
  );
}

describe("deck ownership on the server", () => {
  it("renders empty while disabled even with the subset and prices at hand", () => {
    const client = seededClient();
    expect(renderOverlays(client, false)).toContain("true:true");
    expect(client.isFetching()).toBe(0);
  });

  it("prices a logged-out viewer's deck from the same data once enabled, without the copies", () => {
    const client = seededClient();
    expect(renderOverlays(client, true)).toContain("false:true");
    expect(client.isFetching()).toBe(0);
  });
});
