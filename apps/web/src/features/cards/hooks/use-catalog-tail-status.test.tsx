// @vitest-environment jsdom
import { makeCatalogReference } from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import type { CatalogEntry } from "@/features/cards/lib/catalog-queries";
import { completeCatalogEntry } from "@/features/cards/lib/catalog-queries";

import { useCatalogTailStatus } from "./use-cards";

function wireCatalog(printings: Record<string, string>): CatalogResponse {
  return {
    sets: [],
    cards: {},
    ...makeCatalogReference(),
    printings: Object.fromEntries(
      Object.entries(printings).map(([id, language]) => [
        id,
        { language, markers: [], distributionChannels: [] },
      ]),
    ),
  } as unknown as CatalogResponse;
}

function renderStatus(entry: CatalogEntry) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  client.setQueryData(catalogKeys.all, entry);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useCatalogTailStatus(), { wrapper }) };
}

const partialEntry = (): CatalogEntry => ({
  catalog: wireCatalog({ p1: "EN" }),
  version: "v-1",
  partialLanguages: ["EN"],
});

function stubTail(...statuses: number[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const fetchMock = vi.fn(() => {
    const status = statuses[Math.min(call++, statuses.length - 1)] ?? 200;
    const body = status === 200 ? { printings: wireCatalog({ p2: "SC" }).printings } : {};
    return Promise.resolve(Response.json(body, { status, headers: { ETag: '"v-1"' } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCatalogTailStatus", () => {
  it("is complete without fetching when every language is loaded", () => {
    const fetchMock = stubTail(200);
    const { result } = renderStatus(completeCatalogEntry(wireCatalog({ p1: "EN" })));

    expect(result.current.status).toBe("complete");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the remaining languages right away and reports completion", async () => {
    stubTail(200);
    const { result, client } = renderStatus(partialEntry());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("complete"));
    const entry = client.getQueryData<CatalogEntry>(catalogKeys.all);
    expect(Object.keys(entry?.catalog.printings ?? {}).toSorted()).toEqual(["p1", "p2"]);
  });

  it("reports a failure and recovers on retry", async () => {
    stubTail(503, 503, 503, 503, 200);
    const { result } = renderStatus(partialEntry());

    await waitFor(() => expect(result.current.status).toBe("failed"));
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("complete"));
  });
});
