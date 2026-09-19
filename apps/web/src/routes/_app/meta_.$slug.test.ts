import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { metaKeys } from "@/features/meta/lib/meta-query-keys";
import { metaEvent, metaField, metaRow, metaStandings } from "@/test/meta-event-fixtures";

import { Route } from "./meta_.$slug";

type LoaderFn = (ctx: {
  context: {
    queryClient: {
      query: (options: { queryKey: readonly unknown[] }) => Promise<unknown>;
      getQueryData: (key: readonly unknown[]) => unknown;
      setQueryData: (key: readonly unknown[], data: unknown) => void;
    };
  };
  params: { slug: string };
  deps: Record<string, unknown>;
  location: { search: Record<string, unknown> };
}) => Promise<unknown>;

type DepsFn = (opts: { search: Record<string, unknown> }) => Record<string, unknown>;

const SLUG = "summoner-skirmish";

function loaderDepsFor(search: Record<string, unknown>): Record<string, unknown> {
  return (Route.options.loaderDeps as unknown as DepsFn)({ search });
}

function runLoader(
  search: Record<string, unknown> = {},
  overrides: {
    meta?: boolean;
    missing?: boolean;
    cached?: readonly (readonly unknown[])[];
  } = {},
) {
  const query = vi.fn((options: { queryKey: readonly unknown[] }) => {
    if (options.queryKey[0] === "feature-flags") {
      return Promise.resolve({ meta: overrides.meta ?? true });
    }
    if (options.queryKey[0] === "meta") {
      if (overrides.missing === true) {
        return Promise.reject(new Error("NOT_FOUND"));
      }
      return Promise.resolve({
        event: metaEvent(),
        standings: metaStandings([metaRow()], 2054),
        field: metaField(),
        bestPerLegend: [],
        cutMatches: [],
        phases: [],
      });
    }
    return Promise.resolve({});
  });
  const cached = (overrides.cached ?? []).map((key) => JSON.stringify(key));
  const getQueryData = vi.fn((key: readonly unknown[]) =>
    cached.includes(JSON.stringify(key)) ? metaStandings([metaRow(), metaRow()], 2054) : undefined,
  );
  const setQueryData = vi.fn();
  const loaded = (Route.options.loader as unknown as LoaderFn)({
    context: { queryClient: { query, getQueryData, setQueryData } },
    params: { slug: SLUG },
    deps: loaderDepsFor(search),
    location: { search },
  });
  return { loaded, query, setQueryData };
}

async function warmedKeys(search: Record<string, unknown>): Promise<readonly unknown[][]> {
  const { loaded, query } = runLoader(search);
  await loaded;
  return query.mock.calls.map((call) => [...call[0].queryKey]);
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the loader resolved");
}

const OPENING_VIEW = [...metaKeys.standings(SLUG, { limit: 200, offset: 0 })];

describe("/meta/$slug loader", () => {
  it("returns the event alone, so the standings are not dehydrated twice", async () => {
    const { loaded } = runLoader();

    expect(await loaded).toMatchObject({ slug: SLUG });
  });

  it("seeds the opening view from the page the event payload carries", async () => {
    const { loaded, setQueryData } = runLoader({});
    await loaded;

    expect(setQueryData).toHaveBeenCalledWith(OPENING_VIEW, metaStandings([metaRow()], 2054));
  });

  it("leaves the opening view alone once the cache holds rows of its own", async () => {
    const { loaded, setQueryData } = runLoader({}, { cached: [OPENING_VIEW] });
    await loaded;

    expect(setQueryData).not.toHaveBeenCalled();
  });

  it("still seeds the opening view a reader arriving on a later page will clear back to", async () => {
    const { loaded, setQueryData } = runLoader({ page: 3 });
    await loaded;

    expect(setQueryData).toHaveBeenCalledWith(OPENING_VIEW, metaStandings([metaRow()], 2054));
  });

  it("asks for nothing beyond the seeded page on the opening view", async () => {
    const keys = await warmedKeys({});

    expect(keys.filter((key) => key[3] === "standings")).toEqual([OPENING_VIEW]);
  });

  it("keeps the page and its size out of the cache key, so paging does not rerun the loader", () => {
    expect(loaderDepsFor({ q: "ana", list: "with", page: 3, per: 50 })).toEqual(
      loaderDepsFor({ q: "ana", list: "with" }),
    );
  });

  it("warms the standings page a deep link names", async () => {
    const keys = await warmedKeys({ page: 3, per: 50, q: "ana", list: "with" });

    expect(keys).toContainEqual([
      ...metaKeys.standings(SLUG, { q: "ana", list: "with", limit: 50, offset: 100 }),
    ]);
  });

  it("opens the first page when a stale link names one the schema rejects", async () => {
    const keys = await warmedKeys({ page: "third", per: 7 });

    expect(keys.filter((key) => key[3] === "standings")).toEqual([OPENING_VIEW]);
  });

  it("404s an event the archive does not hold", async () => {
    expect(isNotFound(await thrownBy(runLoader({}, { missing: true }).loaded))).toBe(true);
  });

  it("sends the reader to the catalog while the archive is off", async () => {
    expect(isRedirect(await thrownBy(runLoader({}, { meta: false }).loaded))).toBe(true);
  });
});
