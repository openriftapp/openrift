import { META_MAX_LIST_PAGE_SIZE } from "@openrift/shared/meta-query";
import { describe, expect, it, vi } from "vitest";

import { metaKeys } from "@/features/meta/lib/meta-query-keys";
import { headMeta, headTitle, loadedHead, runRouteLoader } from "@/test/route-head";

import { Route } from "./meta_.players_.$key";

type LoaderContext = ReturnType<typeof makeContext>;
type LoaderFn = (ctx: {
  context: LoaderContext;
  params: { key: string };
  deps: Record<string, unknown>;
}) => Promise<unknown>;

const KEY = "pnrenata";

const SETS = {
  sets: [
    {
      slug: "origins",
      name: "Origins",
      setType: "main",
      releases: { en: { releasedAt: "2026-01-01", precision: "day" } },
    },
    {
      slug: "vendetta",
      name: "Vendetta",
      setType: "main",
      releases: { en: { releasedAt: "2026-08-01", precision: "day" } },
    },
  ],
};

function makeContext() {
  const query = vi.fn((options: { queryKey: readonly unknown[] }) => {
    if (options.queryKey[0] === "sets") {
      return Promise.resolve(SETS);
    }
    return Promise.resolve({ key: KEY, name: "Renata", finishes: [] });
  });
  return { queryClient: { query } };
}

async function warmedKeys(deps: Record<string, unknown> = {}): Promise<readonly unknown[][]> {
  const context = makeContext();
  await (Route.options.loader as unknown as LoaderFn)({ context, params: { key: KEY }, deps });
  return context.queryClient.query.mock.calls.map((call) => [...call[0].queryKey]);
}

describe("/meta/players/$key loader", () => {
  it("keeps the whole archive out of the dehydrated SSR payload", async () => {
    const keys = await warmedKeys();

    expect(keys).not.toContainEqual([...metaKeys.decks()]);
  });

  it("still warms the player the page renders from", async () => {
    const keys = await warmedKeys();

    expect(keys).toContainEqual([...metaKeys.player(KEY)]);
  });

  it("covers the whole career when the URL names no era", async () => {
    const keys = await warmedKeys();

    expect(keys).toContainEqual([
      ...metaKeys.decks({ formats: ["constructed"], player: KEY, limit: META_MAX_LIST_PAGE_SIZE }),
    ]);
  });

  it("warms this player's own lists under the scope the URL names, facets and all", async () => {
    const keys = await warmedKeys({ era: "origins", countriesEx: ["DE"] });

    expect(keys).toContainEqual([
      ...metaKeys.decks({
        from: "2026-01-01",
        to: "2026-07-31",
        formats: ["constructed"],
        countriesEx: ["DE"],
        player: KEY,
        limit: META_MAX_LIST_PAGE_SIZE,
      }),
    ]);
  });

  it("asks for the whole record in one page, since a player's is a few dozen rows", async () => {
    const keys = await warmedKeys({ era: "all", formats: [] });

    expect(keys).toContainEqual([
      ...metaKeys.decks({ player: KEY, limit: META_MAX_LIST_PAGE_SIZE }),
    ]);
  });
});

const PLAYER_DETAIL = {
  key: KEY,
  name: "Renata",
  finishes: [{ rank: 1 }, { rank: 8 }],
};

describe("/meta/players/$key head", () => {
  it("counts the archived finishes", async () => {
    const head = await loadedHead(Route, { key: KEY }, PLAYER_DETAIL);

    expect(headTitle(head)).toBe("Renata in the Meta Archive - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "Renata in the Riftbound meta archive: 2 archived finishes, the legends they brought, and the decklists they registered.",
    );
  });

  it("keeps the finish rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, { key: KEY }, PLAYER_DETAIL)).toEqual({
      name: "Renata",
      finishCount: 2,
    });
  });
});
