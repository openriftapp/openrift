import { makeCatalogReference } from "@openrift/shared/test-factories";
// @vitest-environment jsdom
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { setPreferredCatalogLanguages } from "@/features/cards/lib/catalog-languages";
import { seedCatalogVersion } from "@/features/cards/lib/catalog-version";
import { stubPrinting } from "@/test/factories";

import type { CatalogEntry } from "./catalog-queries";
import {
  buildCardsResult,
  catalogQueryOptions,
  completeCatalogEntry,
  ensureCatalogComplete,
  hasPrintingsOutside,
  primaryCatalogLanguages,
} from "./catalog-queries";

function wireCatalog(
  printings: Record<string, { language: string }>,
  overrides?: Partial<CatalogResponse>,
): CatalogResponse {
  return {
    sets: [],
    cards: {},
    printings: Object.fromEntries(
      Object.entries(printings).map(([id, printing]) => [
        id,
        { markers: [], distributionChannels: [], ...printing },
      ]),
    ),
    ...makeCatalogReference(),
    ...overrides,
  } as CatalogResponse;
}

function setUrl(path: string): void {
  history.replaceState(null, "", path);
}

function setPreferredLanguages(languages: readonly string[]): void {
  setPreferredCatalogLanguages(() => languages);
}

beforeEach(() => {
  setUrl("/");
});

afterEach(() => {
  setPreferredLanguages([]);
  vi.unstubAllGlobals();
});

describe("hasPrintingsOutside", () => {
  it("detects a printing outside the requested languages", () => {
    const catalog = wireCatalog({ a: { language: "EN" }, b: { language: "SC" } });
    expect(hasPrintingsOutside(catalog, ["EN"])).toBe(true);
    expect(hasPrintingsOutside(catalog, ["EN", "SC"])).toBe(false);
  });

  it("is false for an empty catalog", () => {
    expect(hasPrintingsOutside(wireCatalog({}), ["EN"])).toBe(false);
  });
});

describe("primaryCatalogLanguages", () => {
  it("uses the persisted preference, normalized and sorted", () => {
    setPreferredLanguages(["fr", "EN"]);
    expect(primaryCatalogLanguages()).toEqual(["EN", "FR"]);
  });

  it("lets the URL languages filter win over the preference (matches the SSR preload)", () => {
    setPreferredLanguages(["EN"]);
    setUrl(`/cards?languages=${encodeURIComponent('["SC"]')}`);
    expect(primaryCatalogLanguages()).toEqual(["SC"]);
  });

  it("uses the /promos route language", () => {
    setPreferredLanguages(["EN"]);
    setUrl("/promos/kr");
    expect(primaryCatalogLanguages()).toEqual(["KR"]);
  });

  it("ignores a malformed languages param", () => {
    setPreferredLanguages(["EN"]);
    setUrl("/cards?languages=not-json");
    expect(primaryCatalogLanguages()).toEqual(["EN"]);
  });

  it("returns null when no language source is known", () => {
    setPreferredLanguages([]);
    expect(primaryCatalogLanguages()).toBeNull();
  });
});

describe("split fetch + tail merge", () => {
  function stubResponses(
    ...responses: { body: unknown; etag?: string; status?: number }[]
  ): string[] {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(String(url));
        const next = responses[calls.length - 1];
        const headers = next?.etag === undefined ? undefined : { ETag: `"${next.etag}"` };
        return Promise.resolve(Response.json(next?.body, { status: next?.status, headers }));
      }),
    );
    return calls;
  }

  function primary(printings: Record<string, { language: string }>, etag: string) {
    return { body: wireCatalog(printings), etag };
  }

  function tail(printings: Record<string, { language: string }>, etag: string) {
    return { body: { printings: wireCatalog(printings).printings }, etag };
  }

  function newClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  }

  function entryOf(queryClient: QueryClient): CatalogEntry | undefined {
    return queryClient.getQueryData<CatalogEntry>(catalogKeys.all);
  }

  function printingIds(queryClient: QueryClient): string[] {
    return Object.keys(entryOf(queryClient)?.catalog.printings ?? {}).toSorted();
  }

  it("fetches the primary variant, merges the tail, then no-ops on a second call", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(
      primary({ p1: { language: "EN" } }, "v-1"),
      tail({ p2: { language: "SC" } }, "v-1"),
    );
    seedCatalogVersion("v-1");

    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    expect(calls[0]).toContain("langs=EN");
    expect(calls[0]).toContain("v=v-1");
    expect(entryOf(queryClient)?.partialLanguages).toEqual(["EN"]);

    await ensureCatalogComplete(queryClient);
    expect(calls[1]).toContain("/api/v1/catalog/printings?");
    expect(calls[1]).toContain("exceptLangs=EN");
    expect(printingIds(queryClient)).toEqual(["p1", "p2"]);
    expect(entryOf(queryClient)?.partialLanguages).toBeNull();

    await ensureCatalogComplete(queryClient);
    expect(calls).toHaveLength(2);
  });

  it("treats a full response to a variant request as complete (deploy skew)", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(primary({ p1: { language: "EN" }, p2: { language: "SC" } }, "v-2"));
    seedCatalogVersion("v-2");

    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    await ensureCatalogComplete(queryClient);

    expect(calls).toHaveLength(1);
    expect(entryOf(queryClient)?.partialLanguages).toBeNull();
  });

  it("requests the tail at the version the primary was served under", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(
      primary({ p1: { language: "EN" } }, "v-served-3"),
      tail({ p2: { language: "SC" } }, "v-served-3"),
    );
    seedCatalogVersion("v-requested-3");

    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    await ensureCatalogComplete(queryClient);

    expect(calls[1]).toContain("v=v-served-3");
    expect(printingIds(queryClient)).toEqual(["p1", "p2"]);
  });

  it("loads the tail again after a refetch under a new catalog version", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(
      primary({ p1: { language: "EN" } }, "v-old"),
      tail({ p2: { language: "SC" } }, "v-old"),
      primary({ p1: { language: "EN" }, p3: { language: "EN" } }, "v-new"),
      tail({ p2: { language: "SC" }, p4: { language: "FR" } }, "v-new"),
    );
    seedCatalogVersion("v-old");
    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    await ensureCatalogComplete(queryClient);

    seedCatalogVersion("v-new");
    await queryClient.refetchQueries({ queryKey: catalogKeys.all, exact: true });
    expect(printingIds(queryClient)).toEqual(["p1", "p3"]);
    await ensureCatalogComplete(queryClient);

    expect(calls[3]).toContain("v=v-new");
    expect(printingIds(queryClient)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("keeps the complete entry when the version is unchanged", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(
      primary({ p1: { language: "EN" } }, "v-5"),
      tail({ p2: { language: "SC" } }, "v-5"),
    );
    seedCatalogVersion("v-5");
    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    await ensureCatalogComplete(queryClient);
    const complete = entryOf(queryClient);

    seedCatalogVersion("v-5");
    await queryClient.refetchQueries({ queryKey: catalogKeys.all, exact: true });

    expect(calls).toHaveLength(2);
    expect(entryOf(queryClient)).toBe(complete);
  });

  it("drops a tail served from another version and recovers after the refetch", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(
      primary({ p1: { language: "EN" } }, "v-6"),
      tail({ p2: { language: "SC" } }, "v-newer-6"),
      primary({ p1: { language: "EN" } }, "v-newer-6"),
      tail({ p2: { language: "SC" } }, "v-newer-6"),
    );
    seedCatalogVersion("v-6");
    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);

    await ensureCatalogComplete(queryClient);
    expect(calls).toHaveLength(2);
    expect(printingIds(queryClient)).toEqual(["p1"]);
    expect(queryClient.getQueryState(catalogKeys.all)?.isInvalidated).toBe(true);

    await queryClient.query(catalogQueryOptions);
    expect(calls[2]).toContain("v=v-newer-6");
    await ensureCatalogComplete(queryClient);
    expect(calls).toHaveLength(4);
    expect(printingIds(queryClient)).toEqual(["p1", "p2"]);
  });

  it("retries a failed tail fetch", async () => {
    setPreferredLanguages(["EN"]);
    const calls = stubResponses(
      primary({ p1: { language: "EN" } }, "v-7"),
      { body: {}, status: 503 },
      tail({ p2: { language: "SC" } }, "v-7"),
    );
    seedCatalogVersion("v-7");
    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    await ensureCatalogComplete(queryClient);

    expect(calls).toHaveLength(3);
    expect(printingIds(queryClient)).toEqual(["p1", "p2"]);
  });

  it("leaves the entry partial and the tail query failed when every attempt fails", async () => {
    setPreferredLanguages(["EN"]);
    stubResponses(
      primary({ p1: { language: "EN" } }, "v-8"),
      ...Array.from({ length: 4 }, () => ({ body: {}, status: 503 })),
    );
    seedCatalogVersion("v-8");
    const queryClient = newClient();
    await queryClient.query(catalogQueryOptions);
    await ensureCatalogComplete(queryClient);

    expect(entryOf(queryClient)?.partialLanguages).toEqual(["EN"]);
    expect(queryClient.getQueryState(catalogKeys.tail("v-8", ["EN"]))?.status).toBe("error");
  });

  it("no-ops on a complete entry (SSR/full path)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = newClient();
    queryClient.setQueryData(
      catalogKeys.all,
      completeCatalogEntry(wireCatalog({ p1: { language: "EN" } })),
    );
    await ensureCatalogComplete(queryClient);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildCardsResult", () => {
  it("indexes every side by side key and groups the sides of each printing", () => {
    const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
    const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
    const single = stubPrinting({ printingId: "single", cardId: "brush" });
    const result = buildCardsResult({}, [gold, bird, single], []);

    expect(result.printingsBySideKey).toEqual({ pair: bird, "pair:2": gold, single });
    expect(result.sidesByPrinting.get("pair")).toEqual([bird, gold]);
    expect(result.printingsById.pair).toBe(bird);
  });
});
