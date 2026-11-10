import { describe, expect, it, vi } from "vitest";

import { metaKeys } from "@/features/meta/lib/meta-query-keys";
import { headMeta, headTitle, loadedHead, runRouteLoader } from "@/test/route-head";

import { Route } from "./meta_.legends_.$slug";

type LoaderContext = ReturnType<typeof makeContext>;
type LoaderFn = (ctx: {
  context: LoaderContext;
  params: { slug: string };
  deps: Record<string, unknown>;
}) => Promise<unknown>;

const SLUG = "kennen-heart-of-the-tempest";
const CARD_ID = "card-kennen";

const SETS = {
  sets: [
    {
      slug: "origins",
      name: "Origins",
      setType: "main",
      releases: { en: { releasedAt: "2026-01-01", precision: "day" } },
    },
  ],
};

function makeContext() {
  const query = vi.fn((options: { queryKey: readonly unknown[] }) => {
    if (options.queryKey[0] === "sets") {
      return Promise.resolve(SETS);
    }
    return Promise.resolve({ legend: { cardId: CARD_ID }, counts: {}, best: [], finishes: [] });
  });
  return { queryClient: { query } };
}

async function warmedKeys(deps: Record<string, unknown> = {}): Promise<readonly unknown[][]> {
  const context = makeContext();
  await (Route.options.loader as unknown as LoaderFn)({ context, params: { slug: SLUG }, deps });
  return context.queryClient.query.mock.calls.map((call) => [...call[0].queryKey]);
}

describe("/meta/legends/$slug loader", () => {
  it("keeps the whole archive out of the dehydrated SSR payload", async () => {
    const keys = await warmedKeys();

    expect(keys).not.toContainEqual([...metaKeys.decks()]);
  });

  it("warms the legend under the scope in the URL", async () => {
    const keys = await warmedKeys({ era: "origins", tiers: ["premier"] });

    expect(keys).toContainEqual([
      ...metaKeys.legend(SLUG, {
        from: "2026-01-01",
        formats: ["constructed"],
        tiers: ["premier"],
      }),
    ]);
  });

  it("warms one grid's worth of the legend's own lists under the same scope", async () => {
    const keys = await warmedKeys({ era: "origins", tiers: ["premier"] });

    expect(keys).toContainEqual([
      ...metaKeys.decks({
        from: "2026-01-01",
        formats: ["constructed"],
        tiers: ["premier"],
        legend: CARD_ID,
        limit: 8,
      }),
    ]);
  });

  it("reads the legend before the decks, since the card id comes off it", async () => {
    const context = makeContext();
    await (Route.options.loader as unknown as LoaderFn)({
      context,
      params: { slug: SLUG },
      deps: {},
    });
    const reads = context.queryClient.query.mock.calls.map((call) => call[0].queryKey[1]);

    expect(reads.indexOf("legends")).toBeLessThan(reads.indexOf("decks"));
  });
});

const LEGEND_DETAIL = {
  slug: SLUG,
  legend: { cardId: CARD_ID, name: "Kennen, Heart of the Tempest", imageId: "img-kennen" },
  counts: { wins: 2, finishes: 5, decklists: 3 },
  best: [{ playerName: "adtoll" }],
  finishes: [{ playerName: "adtoll" }, { playerName: "pnrenata" }],
  total: 5,
  page: 1,
};

describe("/meta/legends/$slug head", () => {
  it("counts the finishes and unfurls with the legend's art", async () => {
    const head = await loadedHead(Route, { slug: SLUG }, LEGEND_DETAIL);

    expect(headTitle(head)).toBe("Kennen, Heart of the Tempest in the Meta Archive - OpenRift");
    expect(headMeta(head, "description")).toBe(
      "Kennen, Heart of the Tempest in the Riftbound meta archive: 5 archived finishes, the players behind them, and the decklists they registered.",
    );
    expect(headMeta(head, "og:image")).toBe(
      "http://localhost:5173/media/cards/img-kennen-full.webp",
    );
  });

  it("keeps the finish rows out of the loader data", async () => {
    expect(await runRouteLoader(Route, { slug: SLUG }, LEGEND_DETAIL)).toEqual({
      legend: { name: "Kennen, Heart of the Tempest", imageId: "img-kennen" },
      counts: { finishes: 5 },
    });
  });
});
