// @vitest-environment jsdom
import {
  makeCatalogCard,
  makeCatalogPrinting,
  makeCatalogReference,
} from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Component } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogKeys, pricesKeys } from "@/features/cards/lib/cards-query-keys";
import {
  CatalogLanguageOrderContext,
  catalogLanguageOrder,
} from "@/features/cards/lib/catalog-language-order";
import { completeCatalogEntry } from "@/features/cards/lib/catalog-queries";

import { useCatalogWhenReady } from "./use-cards";
import { usePricesOnDemand } from "./use-prices";

const { id: _cardId, ...card } = makeCatalogCard({ id: "card-1" });
const wirePrinting = (language: string, canonicalRank: number) => {
  const {
    printingId: _printingId,
    side: _side,
    ...value
  } = makeCatalogPrinting({ language, canonicalRank });
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
  fetchMock = vi.fn(() => Promise.reject(new Error("network down")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <CatalogLanguageOrderContext value={catalogLanguageOrder(["DE", "EN"])}>
          {children}
        </CatalogLanguageOrderContext>
      </QueryClientProvider>
    );
  };
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>load failed</p> : this.props.children;
  }
}

function renderInBoundary(client: QueryClient, useData: () => unknown) {
  function Probe() {
    return <p>{useData() === undefined ? "pending" : "loaded"}</p>;
  }
  const Wrapper = wrapperFor(client);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <Wrapper>
      <Boundary>
        <Probe />
      </Boundary>
    </Wrapper>,
  );
  return consoleError;
}

describe("usePricesOnDemand", () => {
  it("returns undefined and fetches nothing while disabled", () => {
    const { result } = renderHook(() => usePricesOnDemand(false), {
      wrapper: wrapperFor(newClient()),
    });
    expect(result.current).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a lookup in major units once the prices are cached", () => {
    const client = newClient();
    client.setQueryData(pricesKeys.all, { prices: { p1: { tcgplayer: 250 } } });
    const { result } = renderHook(() => usePricesOnDemand(false), {
      wrapper: wrapperFor(client),
    });
    expect(result.current?.get("p1", "tcgplayer")).toBe(2.5);
  });

  it("throws to the error boundary when the first load fails", async () => {
    const consoleError = renderInBoundary(newClient(), () => usePricesOnDemand(true));
    expect(await screen.findByText("load failed")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("keeps the cached prices when a refetch fails", async () => {
    const client = newClient();
    client.setQueryData(pricesKeys.all, { prices: {} }, { updatedAt: 1 });
    const consoleError = renderInBoundary(client, () => usePricesOnDemand(true));
    await waitFor(() => expect(client.getQueryState(pricesKeys.all)?.status).toBe("error"));
    expect(screen.getByText("loaded")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe("useCatalogWhenReady", () => {
  it("returns undefined and fetches nothing while disabled", () => {
    const { result } = renderHook(() => useCatalogWhenReady(false), {
      wrapper: wrapperFor(newClient()),
    });
    expect(result.current).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the cached catalogue in the viewer's language order", () => {
    const client = newClient();
    client.setQueryData(catalogKeys.all, completeCatalogEntry(CATALOG));
    const { result } = renderHook(() => useCatalogWhenReady(false), {
      wrapper: wrapperFor(client),
    });
    expect(result.current?.allPrintings.map((printing) => printing.language)).toEqual(["DE", "EN"]);
  });

  it("throws to the error boundary when the first load fails", async () => {
    const consoleError = renderInBoundary(newClient(), () => useCatalogWhenReady(true));
    expect(await screen.findByText("load failed")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
