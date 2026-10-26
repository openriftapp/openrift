import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: (fn: (...args: unknown[]) => unknown) => fn,
      validator: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-cache", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { serverCache: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
});

const { serverCache } = await import("@/lib/server-cache");
const { cardDetailQueryOptions } = await import("./card-detail-queries");

function requestUrl(input: string | Request): string {
  return input instanceof Request ? input.url : String(input);
}

describe("cardDetailQueryOptions", () => {
  beforeEach(() => {
    serverCache.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    serverCache.clear();
  });

  it("throws Error('NOT_FOUND') when the API returns 404", async () => {
    const fetchMock = vi.fn((_input: string | Request) =>
      Promise.resolve(
        Response.json(
          { defined: true, code: "NOT_FOUND", status: 404, message: "Not Found" },
          { status: 404 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { queryFn } = cardDetailQueryOptions("does-not-exist");
    expect(queryFn).toBeDefined();
    await expect(
      // The vitest queryFn signature has a context arg; tests don't need it.
      (queryFn as () => Promise<unknown>)(),
    ).rejects.toThrow("NOT_FOUND");

    const urls = fetchMock.mock.calls.map((call) => requestUrl(call[0]));
    expect(urls).toContain("http://localhost:3000/api/v1/cards/does-not-exist");
  });

  it("merges the detail and the related strip into one payload on 200", async () => {
    const detail = {
      card: { id: "x", slug: "x" },
      cards: {},
      printings: {},
      sets: [],
      markers: [],
      distributionChannels: [],
      products: [],
    };
    const related = [{ slug: "yasuo-windrider" }];
    const fetchMock = vi.fn((input: string | Request) =>
      Promise.resolve(Response.json(requestUrl(input).endsWith("/related") ? { related } : detail)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { queryFn } = cardDetailQueryOptions("x");
    const result = await (queryFn as () => Promise<unknown>)();
    expect(result).toEqual({ ...detail, related });
    const urls = fetchMock.mock.calls.map((call) => requestUrl(call[0])).toSorted();
    expect(urls).toEqual([
      "http://localhost:3000/api/v1/cards/x",
      "http://localhost:3000/api/v1/cards/x/related",
    ]);
  });
});

describe("cardDetailQueryOptions select (enrichCardDetail)", () => {
  const card = { id: "card-1", slug: "ezreal", name: "Ezreal", bans: [] };
  const printing = (setId: string, language = "EN") => ({
    setId,
    cardId: "card-1",
    language,
    markers: [],
    distributionChannels: [],
    images: [],
    canonicalRank: 1,
  });
  const releases = {
    EN: { releasedAt: "2025-01-01", precision: "day" },
    FR: { releasedAt: "2099-01-01", precision: "day" },
  };
  const product = (printingId: string, slug: string, name: string, quantity: number) => ({
    printingId,
    slug,
    name,
    quantity,
  });
  const slice = { cards: {}, markers: [], distributionChannels: [], related: [] };

  const runSelect = (response: unknown) => {
    const { select } = cardDetailQueryOptions("ezreal");
    expect(select).toBeDefined();
    return (select as (r: unknown) => ReturnType<typeof Object>)(response) as {
      card: { id: string; bans: unknown[]; upcomingBans: unknown[] };
      printings: {
        printingId: string;
        side: number;
        setSlug: string;
        setReleased: boolean;
        card: { id?: string; slug: string };
        markers: { slug: string }[];
        otherSide?: { cardSlug: string };
      }[];
      productsByPrinting: ReadonlyMap<string, { slug: string; quantity: number }[]>;
      related: { slug: string }[];
    };
  };

  it("groups products by printing id", () => {
    const result = runSelect({
      ...slice,
      card,
      printings: { p1: printing("s1"), p2: printing("s1") },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [
        product("p1", "prerift-ezreal", "Pre-Rift Kit", 2),
        product("p2", "prerift-ezreal", "Pre-Rift Kit", 1),
        product("p1", "arcane-box", "Arcane Box Set", 1),
      ],
    });

    expect(result.productsByPrinting.get("p1")).toEqual([
      product("p1", "prerift-ezreal", "Pre-Rift Kit", 2),
      product("p1", "arcane-box", "Arcane Box Set", 1),
    ]);
    expect(result.productsByPrinting.get("p2")).toEqual([
      product("p2", "prerift-ezreal", "Pre-Rift Kit", 1),
    ]);
  });

  it("omits printings that are in no product", () => {
    const result = runSelect({
      ...slice,
      card,
      printings: { p1: printing("s1") },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.productsByPrinting.get("p1")).toBeUndefined();
    expect(result.productsByPrinting.size).toBe(0);
  });

  it("preserves the API's product order within a printing", () => {
    // The API orders by product name; grouping must not reshuffle.
    const result = runSelect({
      ...slice,
      card,
      printings: { p1: printing("s1") },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [
        product("p1", "arcane-box", "Arcane Box Set", 1),
        product("p1", "prerift-ezreal", "Pre-Rift Kit", 2),
        product("p1", "worlds-2025", "Worlds 2025 Bundle", 1),
      ],
    });

    expect(result.productsByPrinting.get("p1")?.map((p) => p.slug)).toEqual([
      "arcane-box",
      "prerift-ezreal",
      "worlds-2025",
    ]);
  });

  it("joins printings the way the catalog store does: printing id, side, set and card", () => {
    const result = runSelect({
      ...slice,
      card,
      printings: { p1: printing("s1") },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.printings).toHaveLength(1);
    expect(result.printings[0]).toMatchObject({
      printingId: "p1",
      side: 1,
      setSlug: "ogn",
      setReleased: true,
      card: { slug: "ezreal" },
    });
    expect(result.card).toMatchObject({ id: "card-1", slug: "ezreal", upcomingBans: [] });
  });

  it("drops a printing whose set is missing from the payload", () => {
    const result = runSelect({
      ...slice,
      card,
      printings: { p1: printing("s1"), p2: printing("missing-set") },
      sets: [{ id: "s1", slug: "ogn", releases: {} }],
      products: [],
    });

    expect(result.printings.map((p) => p.printingId)).toEqual(["p1"]);
  });

  it("resolves marker slugs against the payload's markers", () => {
    const promo = { id: "m1", slug: "promo", label: "Promo", description: null };
    const result = runSelect({
      ...slice,
      markers: [promo],
      card,
      printings: { p1: { ...printing("s1"), markers: ["promo", "gone"] } },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.printings[0]?.markers).toEqual([promo]);
  });

  it("keeps only this card's face of a double-sided printing, with the other card as `otherSide`", () => {
    const result = runSelect({
      ...slice,
      cards: { "card-2": { slug: "gold", name: "Gold", bans: [] } },
      card,
      printings: {
        p1: {
          ...printing("s1"),
          side2: { ...printing("s1"), cardId: "card-2", faceId: "face-2" },
        },
      },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.printings.map((p) => [p.side, p.card.slug, p.otherSide?.cardSlug])).toEqual([
      [1, "ezreal", "gold"],
    ]);
  });

  it("keeps the second face when this card is side 2 of the printing", () => {
    const result = runSelect({
      ...slice,
      cards: { "card-2": { slug: "gold", name: "Gold", bans: [] } },
      card,
      printings: {
        p1: {
          ...printing("s1"),
          cardId: "card-2",
          side2: { ...printing("s1"), faceId: "face-2" },
        },
      },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.printings.map((p) => [p.side, p.card.slug, p.otherSide?.cardSlug])).toEqual([
      [2, "ezreal", "gold"],
    ]);
  });

  it("keeps both faces when the printing shows this card on each", () => {
    const result = runSelect({
      ...slice,
      card,
      printings: {
        p1: { ...printing("s1"), side2: { ...printing("s1"), faceId: "face-2" } },
      },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.printings.map((p) => [p.side, p.otherSide?.cardSlug])).toEqual([
      [1, "ezreal"],
      [2, "ezreal"],
    ]);
  });

  it("passes related cards through unchanged", () => {
    const related = [{ slug: "yasuo-windrider" }, { slug: "yasuo-remorseful" }];
    const result = runSelect({
      ...slice,
      card,
      printings: {},
      sets: [],
      products: [],
      related,
    });

    expect(result.related).toEqual(related);
  });

  it("resolves setReleased per printing language", () => {
    const result = runSelect({
      ...slice,
      card,
      printings: { p1: printing("s1", "EN"), p2: printing("s1", "FR") },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.printings[0]).toMatchObject({ setSlug: "ogn", setReleased: true });
    expect(result.printings[1]).toMatchObject({ setSlug: "ogn", setReleased: false });
  });

  it("keeps a ban that has not started yet out of the card's bans", () => {
    const current = {
      formatId: "constructed",
      formatName: "Constructed",
      bannedAt: "2025-01-01",
      reason: null,
    };
    const scheduled = { formatId: "2v2", formatName: "2v2", bannedAt: "2099-01-01", reason: null };
    const result = runSelect({
      ...slice,
      card: { ...card, bans: [current, scheduled] },
      printings: { p1: printing("s1") },
      sets: [{ id: "s1", slug: "ogn", releases }],
      products: [],
    });

    expect(result.card.bans).toEqual([current]);
    expect(result.card.upcomingBans).toEqual([scheduled]);
    expect(result.printings[0]?.card).toMatchObject({ bans: [current] });
  });
});
