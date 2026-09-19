import { describe, expect, it, vi } from "vitest";

import { metaFrontSectionQuery, metaFrontUpcomingQuery } from "@/features/meta/lib/meta-front-page";
import { metaKeys } from "@/features/meta/lib/meta-query-keys";

import { Route } from "./meta";

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

const ORIGINS_RANGE = { from: "2025-10-31", to: "2026-03-05" };

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

const ORIGINS_FILTER = { ...ORIGINS_RANGE, formats: ["constructed"] };

describe("/meta loader", () => {
  it("warms each section and the facet counts under the era the scope names", async () => {
    const keys = await warmedKeys({ era: "origins" });

    expect(keys).toContainEqual([...metaKeys.eventFacets(ORIGINS_FILTER)]);
    expect(keys).toContainEqual([
      ...metaKeys.eventPage(metaFrontSectionQuery(ORIGINS_FILTER, "premier")),
    ]);
    expect(keys).toContainEqual([...metaKeys.eventPage(metaFrontUpcomingQuery(ORIGINS_FILTER))]);
  });

  it("reruns for a facet and the decklist toggle, which the server now applies", async () => {
    const deps = Route.options.loaderDeps as unknown as LoaderDepsFn;

    expect(deps({ search: { era: "origins" } })).not.toEqual(deps({ search: { era: "proving" } }));
    expect(deps({ search: { era: "origins", tiers: ["premier"] } })).not.toEqual(
      deps({ search: { era: "origins" } }),
    );
    expect(deps({ search: { era: "origins", decks: true } })).not.toEqual(
      deps({ search: { era: "origins" } }),
    );
  });

  it("warms the whole archive once the reader asks for all time", async () => {
    const keys = await warmedKeys({ era: "all" });

    expect(keys).toContainEqual([...metaKeys.eventFacets({ formats: ["constructed"] })]);
  });

  it("warms the archive-wide counts the tier links promise", async () => {
    const keys = await warmedKeys({ era: "origins" });

    expect(keys).toContainEqual([...metaKeys.counts()]);
  });
});
