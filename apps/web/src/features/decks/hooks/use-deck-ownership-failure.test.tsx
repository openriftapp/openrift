// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pricesKeys } from "@/features/cards/lib/cards-query-keys";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";

import { useDeckOwnershipFailure } from "./use-deck-ownership-failure";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function failQuery(client: QueryClient, queryKey: readonly unknown[]) {
  await client
    .query({ queryKey, queryFn: () => Promise.reject(new Error("down")) })
    .catch(() => {});
}

function renderFailure(client: QueryClient, enabled = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useDeckOwnershipFailure(enabled), { wrapper }).result;
}

describe("useDeckOwnershipFailure", () => {
  it("reports nothing while the queries are untouched, and fetches nothing itself", () => {
    const result = renderFailure(newClient());
    expect(result.current.failed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a failed first load of the prices", async () => {
    const client = newClient();
    await failQuery(client, pricesKeys.all);
    expect(renderFailure(client).current.failed).toBe(true);
  });

  it("reports a failed first load of the catalogue", async () => {
    const client = newClient();
    await failQuery(client, catalogQueryOptions.queryKey);
    expect(renderFailure(client).current.failed).toBe(true);
  });

  it("ignores a failed catalogue when the page holds its own catalogue subset", async () => {
    const client = newClient();
    await failQuery(client, catalogQueryOptions.queryKey);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <CatalogSubsetContext value={{} as UseCardsResult}>{children}</CatalogSubsetContext>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useDeckOwnershipFailure(true), { wrapper });
    expect(result.current.failed).toBe(false);
  });

  it("stays quiet when a refetch fails with data already on screen", async () => {
    const client = newClient();
    client.setQueryData(pricesKeys.all, { prices: {} }, { updatedAt: 1 });
    await failQuery(client, pricesKeys.all);
    expect(renderFailure(client).current.failed).toBe(false);
  });

  it("stays quiet while disabled", async () => {
    const client = newClient();
    await failQuery(client, pricesKeys.all);
    expect(renderFailure(client, false).current.failed).toBe(false);
  });

  it("refetches the failed query on retry", async () => {
    const client = newClient();
    await failQuery(client, pricesKeys.all);
    const result = renderFailure(client);
    act(() => result.current.retry());
    await waitFor(() => expect(client.getQueryState(pricesKeys.all)?.fetchStatus).toBe("fetching"));
    expect(result.current.failed).toBe(false);
  });
});
