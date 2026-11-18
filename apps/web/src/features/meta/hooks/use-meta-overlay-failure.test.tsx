// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pricesKeys } from "@/features/cards/lib/cards-query-keys";
import { metaDeckCardsQueryOptions } from "@/features/meta/lib/meta-queries";

import { useMetaOverlayFailure } from "./use-meta-overlay-failure";

const DECKS = { event: "summoner-skirmish" };

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

function renderFailure(client: QueryClient, options = { enabled: true, withPrices: true }) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMetaOverlayFailure(DECKS, options), { wrapper }).result;
}

describe("useMetaOverlayFailure", () => {
  it("reports nothing while the queries are untouched, and fetches nothing itself", () => {
    const result = renderFailure(newClient());
    expect(result.current.failed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a failed first load of the deck cards", async () => {
    const client = newClient();
    await failQuery(client, metaDeckCardsQueryOptions(DECKS).queryKey);
    expect(renderFailure(client).current.failed).toBe(true);
  });

  it("ignores a failed price load when the page shows no prices", async () => {
    const client = newClient();
    await failQuery(client, pricesKeys.all);
    expect(renderFailure(client).current.failed).toBe(true);
    expect(renderFailure(client, { enabled: true, withPrices: false }).current.failed).toBe(false);
  });

  it("stays quiet when a refetch fails with data already on screen", async () => {
    const client = newClient();
    client.setQueryData(pricesKeys.all, { prices: {} }, { updatedAt: 1 });
    await failQuery(client, pricesKeys.all);
    expect(client.getQueryState(pricesKeys.all)?.status).toBe("error");
    expect(renderFailure(client).current.failed).toBe(false);
  });

  it("stays quiet while disabled", async () => {
    const client = newClient();
    await failQuery(client, pricesKeys.all);
    expect(renderFailure(client, { enabled: false, withPrices: true }).current.failed).toBe(false);
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
