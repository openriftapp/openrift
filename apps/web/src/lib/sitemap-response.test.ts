import type { SitemapDataResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it, vi } from "vitest";

import type { SitemapInput } from "./sitemap";
import { renderSitemapFile, renderSitemapIndex, SITEMAP_FILE_LIMIT } from "./sitemap";
import { createSitemapResponder, SITEMAP_CACHE_CONTROL } from "./sitemap-response";

const ORIGIN = "https://openrift.app";

function entries(prefix: string, count: number): SitemapDataResponse["cards"] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `${prefix}-${index}`,
    updatedAt: "2026-08-01T12:00:00.000Z",
  }));
}

function input(players = 3): SitemapInput {
  return {
    siteUrl: ORIGIN,
    helpArticles: [],
    eras: [],
    data: {
      cards: entries("card", 2),
      sets: entries("set", 1),
      products: [],
      metaEvents: entries("event", 1),
      metaDecks: entries("deck", 1),
      metaLegends: entries("legend", 1),
      metaPlayers: entries("player", players),
      rules: [],
    },
  };
}

function setup(options: { load?: () => Promise<SitemapInput>; ttlMs?: number } = {}) {
  let clock = 0;
  const load = vi.fn(options.load ?? (() => Promise.resolve(input())));
  const respond = createSitemapResponder({ load, now: () => clock, ttlMs: options.ttlMs });
  return {
    load,
    respond,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

function get(path: string, headers: Record<string, string> = {}, origin = ORIGIN): Request {
  return new Request(`${origin}${path}`, { headers });
}

async function bodyOf(response: Promise<Response | null>): Promise<string> {
  const resolved = await response;
  return resolved === null ? "" : resolved.text();
}

async function etagOf(response: Promise<Response | null>): Promise<string> {
  const resolved = await response;
  return resolved?.headers.get("etag") ?? "";
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>(?<loc>[^<]*)<\/loc>/gu)].map((match) => match.groups?.loc ?? "");
}

describe("createSitemapResponder", () => {
  it("serves the index and a section file with cache headers and the rendered XML", async () => {
    const { respond } = setup();

    const index = await respond(get("/sitemap.xml"));
    const players = await respond(get("/sitemap-meta-players.xml"));

    expect(index?.status).toBe(200);
    expect(index?.headers.get("cache-control")).toBe(SITEMAP_CACHE_CONTROL);
    expect(index?.headers.get("content-type")).toBe("application/xml");
    expect(index?.headers.get("etag")).toMatch(/^W\/"[\w-]+"$/u);
    expect(await index?.text()).toBe(renderSitemapIndex(input()));
    expect(await players?.text()).toBe(renderSitemapFile("meta-players", 0, input()));
  });

  it("lists every URL of every section file exactly once", async () => {
    const big = input(SITEMAP_FILE_LIMIT + 5);
    const { respond } = setup({ load: () => Promise.resolve(big) });

    const indexXml = await bodyOf(respond(get("/sitemap.xml")));
    const served: string[] = [];
    for (const file of locs(indexXml)) {
      served.push(...locs(await bodyOf(respond(get(new URL(file).pathname)))));
    }

    const expected = [
      ...big.data.metaPlayers.map((entry) => `${ORIGIN}/meta/players/${entry.slug}`),
      ...big.data.metaDecks.map((entry) => `${ORIGIN}/meta/decks/${entry.slug}`),
    ];
    const servedSet = new Set(served);
    expect(servedSet.size).toBe(served.length);
    expect(expected.filter((loc) => !servedSet.has(loc))).toEqual([]);
  });

  it("answers a matching If-None-Match with 304 and no body", async () => {
    const { respond } = setup();
    const first = await respond(get("/sitemap-site.xml"));
    const etag = first?.headers.get("etag") ?? "";

    const revalidated = await respond(get("/sitemap-site.xml", { "if-none-match": etag }));

    expect(revalidated?.status).toBe(304);
    expect(revalidated?.headers.get("etag")).toBe(etag);
    expect(revalidated?.headers.get("cache-control")).toBe(SITEMAP_CACHE_CONTROL);
    expect(await revalidated?.text()).toBe("");
  });

  it("matches a strong or listed form of its weak ETag, and the wildcard", async () => {
    const { respond } = setup();
    const etag = await etagOf(respond(get("/sitemap.xml")));
    const strong = etag.slice(2);

    for (const header of [strong, `"other", ${etag}`, "*"]) {
      const response = await respond(get("/sitemap.xml", { "if-none-match": header }));
      expect(response?.status).toBe(304);
    }
    const stale = await respond(get("/sitemap.xml", { "if-none-match": 'W/"other"' }));
    expect(stale?.status).toBe(200);
  });

  it("keeps the ETag when the data is unchanged and changes it when it differs", async () => {
    let players = 3;
    const { respond, advance } = setup({ load: () => Promise.resolve(input(players)), ttlMs: 10 });
    const before = await etagOf(respond(get("/sitemap-meta-players.xml")));

    advance(10);
    expect(await etagOf(respond(get("/sitemap-meta-players.xml")))).toBe(before);

    players = 4;
    advance(10);
    expect(await etagOf(respond(get("/sitemap-meta-players.xml")))).not.toBe(before);
  });

  it("serves fresh data on the first request after expiry, however long ago", async () => {
    let players = 3;
    const { respond, advance } = setup({ load: () => Promise.resolve(input(players)), ttlMs: 10 });
    await respond(get("/sitemap-meta-players.xml"));

    players = 4;
    advance(1_000_000);
    const body = await bodyOf(respond(get("/sitemap-meta-players.xml")));

    expect(body).toContain("/meta/players/player-3<");
  });

  it("loads the data once for concurrent requests and reuses it until it expires", async () => {
    const { respond, load, advance } = setup({ ttlMs: 1000 });

    await Promise.all(
      ["/sitemap.xml", "/sitemap-site.xml", "/sitemap-meta-players.xml"].map((path) =>
        respond(get(path)),
      ),
    );
    advance(999);
    await respond(get("/sitemap-meta-decks.xml"));
    expect(load).toHaveBeenCalledTimes(1);

    advance(1);
    await respond(get("/sitemap-site.xml"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("serves the previous data while a refresh fails", async () => {
    let fail = false;
    const { respond, load, advance } = setup({
      load: () => (fail ? Promise.reject(new Error("api down")) : Promise.resolve(input())),
      ttlMs: 10,
    });
    const first = await bodyOf(respond(get("/sitemap-site.xml")));

    fail = true;
    advance(10);
    const stale = await respond(get("/sitemap-site.xml"));

    expect(stale?.status).toBe(200);
    expect(await stale?.text()).toBe(first);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("returns 500 without caching headers when the first load fails, and retries next time", async () => {
    let fail = true;
    const { respond, load } = setup({
      load: () => (fail ? Promise.reject(new Error("api down")) : Promise.resolve(input())),
    });

    const failed = await respond(get("/sitemap.xml"));
    expect(failed?.status).toBe(500);
    expect(failed?.headers.get("cache-control")).toBeNull();

    fail = false;
    const recovered = await respond(get("/sitemap.xml"));
    expect(recovered?.status).toBe(200);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("returns 404 without caching headers for a section file past the last one", async () => {
    const { respond } = setup();

    const missing = await respond(get("/sitemap-meta-players-2.xml"));

    expect(missing?.status).toBe(404);
    expect(missing?.headers.get("cache-control")).toBeNull();
  });

  it("leaves other paths and unknown sitemap sections to the page handler", async () => {
    const { respond, load } = setup();

    expect(await respond(get("/cards"))).toBeNull();
    expect(await respond(get("/sitemap-unknown.xml"))).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("answers 404 on a non-official host without loading data", async () => {
    const { respond, load } = setup();

    for (const path of ["/sitemap.xml", "/sitemap-site.xml", "/sitemap-unknown.xml"]) {
      const response = await respond(get(path, {}, "https://preview.openrift.app"));
      expect(response?.status).toBe(404);
      expect(await response?.text()).toBe("Not found");
      expect(response?.headers.get("cache-control")).toBeNull();
    }
    expect(load).not.toHaveBeenCalled();
  });
});
