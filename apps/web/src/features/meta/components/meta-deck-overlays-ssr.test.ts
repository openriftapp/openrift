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

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { completeCatalogEntry } from "@/features/cards/lib/catalog-queries";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import { useMetaDeckBans } from "@/features/meta/hooks/use-meta-deck-bans";
import { useMetaDeckCosts } from "@/features/meta/hooks/use-meta-deck-costs";
import { useMetaOwnedCards } from "@/features/meta/hooks/use-meta-owned-cards";
import { metaDeckCardsQueryOptions } from "@/features/meta/lib/meta-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { stubInitResponse } from "@/test/init-fixtures";

const DECKS = { event: "summoner-skirmish" };

const { id: _cardId, ...card } = makeCatalogCard({ id: "card-1" });
const { printingId: _printingId, side: _side, ...printing } = makeCatalogPrinting({});
const CATALOG: CatalogResponse = {
  sets: [{ id: "set-1", slug: "RB1", name: "First Set", releases: {}, setType: "main" }],
  cards: { "card-1": card },
  printings: { p1: printing },
  ...makeCatalogReference(),
};

function seededClient(): QueryClient {
  const client = new QueryClient();
  // The meta routes prefetch init in their loaders.
  client.setQueryData(initQueryOptions.queryKey, stubInitResponse());
  client.setQueryData(metaDeckCardsQueryOptions(DECKS).queryKey, {
    cards: ["card-1"],
    decks: [{ deckId: "deck-1", entries: [0, 3], sideboard: [] }],
  });
  client.setQueryData(catalogKeys.all, completeCatalogEntry(CATALOG));
  client.setQueryData(pricesQueryOptions.queryKey, {
    prices: { p1: { cardmarket: 120 } },
    currencies: { tcgplayer: "USD", cardmarket: "EUR", cardtrader: "EUR", cardnexus: "EUR" },
  });
  return client;
}

function renderOverlays(client: QueryClient, enabled: boolean): string {
  function Overlays() {
    const costs = useMetaDeckCosts(true, { enabled, withCollection: false, decks: DECKS });
    const bans = useMetaDeckBans(DECKS, enabled);
    const owned = useMetaOwnedCards(false);
    return createElement(
      "p",
      null,
      `${costs === undefined}:${bans === undefined}:${owned === undefined}`,
    );
  }
  return renderToString(createElement(QueryClientProvider, { client }, createElement(Overlays)));
}

describe("meta deck overlays on the server", () => {
  it("render empty while disabled even with the deck cards, catalogue and prices cached", () => {
    const client = seededClient();
    const html = renderOverlays(client, false);
    expect(html).toContain("true:true:true");
    expect(client.isFetching()).toBe(0);
  });

  it("compute from the same cache once enabled", () => {
    expect(renderOverlays(seededClient(), true)).toContain("false:false:true");
  });
});
