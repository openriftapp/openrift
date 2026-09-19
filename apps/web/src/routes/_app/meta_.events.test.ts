import { describe, expect, it, vi } from "vitest";

import { metaKeys } from "@/features/meta/lib/meta-query-keys";

import { Route } from "./meta_.events";

type LoaderContext = ReturnType<typeof makeContext>;
type LoaderFn = (ctx: { context: LoaderContext; deps: unknown }) => Promise<unknown>;
type LoaderDepsFn = (ctx: { search: Record<string, unknown> }) => unknown;

const SETS = {
  sets: [
    {
      slug: "origins",
      name: "Origins",
      setType: "main",
      releases: { en: { releasedAt: "2025-10-31", precision: "day" } },
    },
    {
      slug: "proving",
      name: "Proving Grounds",
      setType: "main",
      releases: { en: { releasedAt: "2026-03-06", precision: "day" } },
    },
  ],
};

const ORIGINS_FILTER = {
  from: "2025-10-31",
  to: "2026-03-05",
  formats: ["constructed"],
};

/** What the page itself asks for when a link names no order. */
const DEFAULT_ORDER = { by: "date", dir: "desc" } as const;

function makeContext() {
  const query = vi.fn((options: { queryKey: readonly unknown[] }) =>
    Promise.resolve(options.queryKey[0] === "sets" ? SETS : {}),
  );
  return { queryClient: { query } };
}

async function warmedKeys(search: Record<string, unknown>): Promise<readonly unknown[][]> {
  const context = makeContext();
  const deps = (Route.options.loaderDeps as unknown as LoaderDepsFn)({ search });
  await (Route.options.loader as unknown as LoaderFn)({ context, deps });
  return context.queryClient.query.mock.calls.map((call) => [...call[0].queryKey]);
}

describe("/meta/events loader", () => {
  it("warms the first page of the era the scope names, under the order the page asks for", async () => {
    const keys = await warmedKeys({ era: "origins" });

    expect(keys).toContainEqual([
      ...metaKeys.eventPage({ ...ORIGINS_FILTER, ...DEFAULT_ORDER, limit: 50, offset: 0 }),
    ]);
  });

  it("warms the page a link names, at the size it names", async () => {
    const keys = await warmedKeys({ era: "origins", page: 3, per: 100 });

    expect(keys).toContainEqual([
      ...metaKeys.eventPage({ ...ORIGINS_FILTER, ...DEFAULT_ORDER, limit: 100, offset: 200 }),
    ]);
  });

  it("warms the order a link names", async () => {
    const keys = await warmedKeys({ era: "origins", by: "players", dir: "asc" });

    expect(keys).toContainEqual([
      ...metaKeys.eventPage({
        ...ORIGINS_FILTER,
        by: "players",
        dir: "asc",
        limit: 50,
        offset: 0,
      }),
    ]);
  });

  it("warms the facet counts under the same filter as the list", async () => {
    const keys = await warmedKeys({ era: "origins", q: "worlds" });

    expect(keys).toContainEqual([...metaKeys.eventFacets({ ...ORIGINS_FILTER, q: "worlds" })]);
  });

  it("reruns for the search box, the sort and the page, which the server applies", async () => {
    const deps = Route.options.loaderDeps as unknown as LoaderDepsFn;

    expect(deps({ search: { era: "origins" } })).not.toEqual(deps({ search: { era: "proving" } }));
    expect(deps({ search: { era: "origins", q: "worlds" } })).not.toEqual(
      deps({ search: { era: "origins" } }),
    );
    expect(deps({ search: { era: "origins", by: "players" } })).not.toEqual(
      deps({ search: { era: "origins" } }),
    );
    expect(deps({ search: { era: "origins", page: 2 } })).not.toEqual(
      deps({ search: { era: "origins" } }),
    );
  });

  it("warms the whole list once the reader asks for all time", async () => {
    const keys = await warmedKeys({ era: "all" });

    expect(keys).toContainEqual([
      ...metaKeys.eventPage({ formats: ["constructed"], ...DEFAULT_ORDER, limit: 50, offset: 0 }),
    ]);
  });

  it("warms the archive-wide counts the title line measures against", async () => {
    const keys = await warmedKeys({ era: "origins" });

    expect(keys).toContainEqual([...metaKeys.counts()]);
  });
});
