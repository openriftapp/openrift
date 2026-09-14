// @vitest-environment jsdom
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { setPreferredCatalogLanguages } from "@/features/cards/lib/catalog-languages";
import { seedCatalogVersion } from "@/features/cards/lib/catalog-version";

import {
  catalogQueryOptions,
  hasPrintingsOutside,
  loadCatalogTail,
  primaryCatalogLanguages,
} from "./catalog-query";

function wireCatalog(
  printings: Record<string, { language: string }>,
  overrides?: Partial<CatalogResponse>,
): CatalogResponse {
  return {
    sets: [],
    cards: {},
    printings,
    totalCopies: 0,
    customTagAssignments: {},
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
  it("fetches the primary variant, merges the tail, then no-ops on a second call", async () => {
    setPreferredLanguages(["EN"]);
    const primary = wireCatalog({ p1: { language: "EN" } });
    const tail = wireCatalog({ p2: { language: "SC" } });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(String(url));
        const body = calls.length === 1 ? primary : tail;
        return Promise.resolve(Response.json(body));
      }),
    );
    seedCatalogVersion("v-test-1");

    const queryClient = new QueryClient();
    const data = await queryClient.query(catalogQueryOptions);
    const raw = queryClient.getQueryData<CatalogResponse>(catalogKeys.all);
    expect(raw).toBeDefined();
    expect(data).toBeDefined();
    expect(calls[0]).toContain("langs=EN");
    expect(calls[0]).toContain("v=v-test-1");

    await loadCatalogTail(queryClient);
    expect(calls[1]).toContain("exceptLangs=EN");
    const merged = queryClient.getQueryData<CatalogResponse>(catalogKeys.all);
    expect(merged).toBeDefined();
    expect(Object.keys((merged as CatalogResponse).printings).toSorted()).toEqual(["p1", "p2"]);

    await loadCatalogTail(queryClient);
    expect(calls).toHaveLength(2);
  });

  it("treats a full response to a variant request as complete (deploy skew)", async () => {
    setPreferredLanguages(["EN"]);
    const full = wireCatalog({ p1: { language: "EN" }, p2: { language: "SC" } });
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(full)));
    vi.stubGlobal("fetch", fetchMock);
    seedCatalogVersion("v-test-2");

    const queryClient = new QueryClient();
    await queryClient.query(catalogQueryOptions);

    await loadCatalogTail(queryClient);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no-ops on a catalog entry without split metadata (SSR/full path)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient();
    queryClient.setQueryData(catalogKeys.all, wireCatalog({ p1: { language: "EN" } }));
    await loadCatalogTail(queryClient);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
