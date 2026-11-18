// @vitest-environment jsdom
import {
  makeCatalogCard,
  makeCatalogPrinting,
  makeCatalogReference,
} from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import {
  CatalogLanguageOrderContext,
  catalogLanguageOrder,
} from "@/features/cards/lib/catalog-language-order";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { buildCardsResult, completeCatalogEntry } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { stubPrinting } from "@/test/factories";

import { useCards } from "./use-cards";

const { id: _cardId, ...card } = makeCatalogCard({ id: "card-1" });
const wirePrinting = (language: string, canonicalRank: number) => {
  const {
    printingId: _printingId,
    side: _side,
    ...value
  } = makeCatalogPrinting({
    language,
    canonicalRank,
  });
  return value;
};

const CATALOG: CatalogResponse = {
  sets: [{ id: "set-1", slug: "RB1", name: "First Set", releases: {}, setType: "main" }],
  cards: { "card-1": card },
  printings: { p1: wirePrinting("EN", 0), p2: wirePrinting("DE", 1) },
  ...makeCatalogReference(),
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.reject(new Error("unexpected fetch")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderProbes(client: QueryClient, wrap: (children: ReactNode) => ReactNode) {
  const seen: UseCardsResult[] = [];
  function Probe() {
    seen.push(useCards());
    return <span>probe</span>;
  }
  render(
    <QueryClientProvider client={client}>
      <CatalogLanguageOrderContext value={catalogLanguageOrder(["DE", "EN"])}>
        <Suspense fallback={null}>
          {wrap(
            <>
              <Probe />
              <Probe />
            </>,
          )}
        </Suspense>
      </CatalogLanguageOrderContext>
    </QueryClientProvider>,
  );
  return seen;
}

describe("useCards", () => {
  it("hands every component the same language-ordered catalogue", async () => {
    const client = new QueryClient();
    client.setQueryData(catalogKeys.all, completeCatalogEntry(CATALOG));

    const seen = renderProbes(client, (children) => children);
    await screen.findAllByText("probe");

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.every((catalog) => catalog === seen[0])).toBe(true);
    expect(seen[0]?.allPrintings.map((p) => p.language)).toEqual(["DE", "EN"]);
  });

  it("re-sorts once when the cached catalogue grows", async () => {
    const client = new QueryClient();
    client.setQueryData(catalogKeys.all, completeCatalogEntry(CATALOG));
    const seen = renderProbes(client, (children) => children);
    await screen.findAllByText("probe");

    client.setQueryData(
      catalogKeys.all,
      completeCatalogEntry({
        ...CATALOG,
        printings: { ...CATALOG.printings, p3: wirePrinting("FR", 2) },
      }),
    );

    await waitFor(() =>
      expect(seen.at(-1)?.allPrintings.map((p) => p.language)).toEqual(["DE", "EN", "FR"]),
    );
    expect(seen.at(-2)).toBe(seen.at(-1));
  });

  it("serves a page's subset without fetching or caching the catalogue", async () => {
    const client = new QueryClient();
    const subset = buildCardsResult(
      {},
      [stubPrinting({ language: "EN" }), stubPrinting({ language: "DE" })],
      [],
    );

    const seen = renderProbes(client, (children) => (
      <CatalogSubsetContext value={subset}>{children}</CatalogSubsetContext>
    ));
    await screen.findAllByText("probe");

    expect(seen[0]?.allPrintings.map((p) => p.language)).toEqual(["DE", "EN"]);
    expect(seen[1]).toBe(seen[0]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
