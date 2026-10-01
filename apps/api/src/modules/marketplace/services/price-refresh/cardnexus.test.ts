/* oxlint-disable
   no-empty-function
   -- test file: mocks require empty fns */
import type { Logger } from "@openrift/shared/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../../deps.js";
import type { Fetch } from "../../../../io.js";
import { refreshCardnexusPrices } from "./cardnexus.js";
import type { StagingRow, UpsertCounts } from "./types.js";
import * as upsertMod from "./upsert.js";

const FEEDS_URL = "https://public-api.cardnexus.com/v1/feeds/riftbound";

const ZERO_COUNTS: UpsertCounts = {
  prices: { total: 0, new: 0, updated: 0, unchanged: 0 },
};

const EXPANSION = { id: 1124, name: "Origins - Main Set", code: "OGN" };

const CARD = {
  id: 151_160,
  productType: "card",
  name: "Blazing Scorcher",
  expansionId: 1124,
  externalIds: {
    cardmarket: [
      { finish: "Standard", id: 845_712 },
      { finish: "Foil", id: 845_712 },
    ],
    tcgplayer: [
      { finish: "Standard", id: 652_771 },
      { finish: "Foil", id: 652_772 },
    ],
  },
};

const SEALED = {
  id: 160_000,
  productType: "sealed",
  name: "Origins Booster Box",
  expansionId: 1124,
  externalIds: null,
};

function euNm(byLanguage: Record<string, { low: number | null }>) {
  return { cardnexus: { regions: { eu: { byCondition: { NM: { byLanguage } } } } } };
}

const CARD_PRICES = {
  productId: CARD.id,
  pricesByFinish: {
    Standard: {
      cardnexus: {
        regions: {
          eu: {
            byCondition: {
              NM: { byLanguage: { en: { low: 0.02 }, "zh-cn": { low: 0.06 } } },
              LP: { byLanguage: { en: { low: 0.01 } } },
            },
          },
          na: { byCondition: { NM: { byLanguage: { en: { low: 0.1 } } } } },
        },
      },
    },
    Foil: euNm({ en: { low: 0.07 }, de: { low: 0.05 } }),
    "Rainbow Foil": euNm({ en: { low: 9 } }),
  },
};

interface FeedConfig {
  expansions?: unknown[];
  catalog?: unknown[];
  prices?: unknown[];
  generatedAt?: string;
  missingFeed?: "catalog" | "expansions" | "prices";
}

function ndjsonGzip(records: unknown[]): ReadableStream<Uint8Array> {
  return new Blob([records.map((r) => JSON.stringify(r)).join("\n")])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
}

function makeFetch(config: FeedConfig = {}) {
  const files: Record<string, unknown[]> = {
    expansions: config.expansions ?? [EXPANSION],
    catalog: config.catalog ?? [CARD, SEALED],
    prices: config.prices ?? [CARD_PRICES],
  };
  const generatedAt = config.generatedAt ?? "2026-10-01T02:08:57.580Z";
  const fetchFn = vi.fn<Fetch>(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === FEEDS_URL) {
      const feed = (name: string) =>
        name === config.missingFeed ? null : { url: `https://feeds.test/${name}`, generatedAt };
      return Response.json({
        catalog: feed("catalog"),
        expansions: feed("expansions"),
        prices: feed("prices"),
      });
    }
    const name = url.replace("https://feeds.test/", "");
    return new Response(ndjsonGzip(files[name] ?? []));
  });
  return fetchFn;
}

interface MockReposConfig {
  ignoredProductIds?: number[];
  ignoredVariantKeys?: string[];
  existingSources?: {
    marketplace: string;
    externalId: number;
    printingId: string;
    finish: string;
    language: string | null;
  }[];
  printings?: { id: string; finish: string; language: string }[];
}

function createMockRepos(config: MockReposConfig = {}) {
  const printings = (config.printings ?? []).map((p) => ({
    ...p,
    cardId: "card-1",
    setId: "set-1",
    shortCode: "OGN-001",
    publicCode: "OGN-001/298",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
  }));
  const existingSources = (config.existingSources ?? []).map((s) => ({
    ...s,
    groupId: 1,
    productName: "Blazing Scorcher",
  }));
  return {
    priceRefresh: {
      loadIgnoredKeys: vi.fn(async () => ({
        productIds: new Set(config.ignoredProductIds),
        variantKeys: new Set(config.ignoredVariantKeys),
      })),
      upsertGroups: vi.fn(async () => {}),
      existingSourcesByMarketplaces: vi.fn(async (marketplaces: string[]) =>
        existingSources.filter((src) => marketplaces.includes(src.marketplace)),
      ),
      allPrintingsForPriceMatch: vi.fn(async () => printings),
      batchInsertProductVariants: vi.fn(async () => {}),
    },
    marketplace: { refreshLatestPrices: vi.fn(async () => {}) },
  } as unknown as Repos;
}

const log = { info: () => {} } as unknown as Logger;

describe("refreshCardnexusPrices", () => {
  let upsertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    upsertSpy = vi.spyOn(upsertMod, "upsertPriceData" as any).mockResolvedValue(ZERO_COUNTS);
  });

  afterEach(() => {
    upsertSpy.mockRestore();
  });

  function stagedRows(): StagingRow[] {
    return upsertSpy.mock.calls[0]![3] as StagingRow[];
  }

  it("authenticates the feeds request and downloads the files without the key", async () => {
    const fetchFn = makeFetch();

    await refreshCardnexusPrices(fetchFn, createMockRepos(), log, "cnk_live_test");

    const [feedsCall, ...downloads] = fetchFn.mock.calls;
    expect(feedsCall![0]).toBe(FEEDS_URL);
    expect(new Headers(feedsCall![1]?.headers).get("authorization")).toBe("Bearer cnk_live_test");
    expect(downloads).toHaveLength(3);
    for (const [, init] of downloads) {
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
    }
  });

  it("stages the lowest EU Near Mint listing per finish and language in cents", async () => {
    await refreshCardnexusPrices(makeFetch(), createMockRepos(), log, "key");

    const rows = stagedRows().map((row) => ({
      externalId: row.externalId,
      groupId: row.groupId,
      finish: row.finish,
      language: row.language,
      lowCents: row.lowCents,
      marketCents: row.marketCents,
    }));
    expect(rows).toEqual([
      {
        externalId: CARD.id,
        groupId: 1124,
        finish: "normal",
        language: "EN",
        lowCents: 2,
        marketCents: null,
      },
      {
        externalId: CARD.id,
        groupId: 1124,
        finish: "normal",
        language: "SC",
        lowCents: 6,
        marketCents: null,
      },
      {
        externalId: CARD.id,
        groupId: 1124,
        finish: "foil",
        language: "EN",
        lowCents: 7,
        marketCents: null,
      },
    ]);
  });

  it("dates the snapshot by the prices feed's generation day", async () => {
    await refreshCardnexusPrices(
      makeFetch({ generatedAt: "2026-09-30T23:59:00.000Z" }),
      createMockRepos(),
      log,
      "key",
    );

    expect(stagedRows()[0]!.recordedAt).toEqual(new Date("2026-09-30"));
  });

  it("skips prices of products missing from the catalog", async () => {
    await refreshCardnexusPrices(
      makeFetch({ prices: [CARD_PRICES, { ...CARD_PRICES, productId: 999 }] }),
      createMockRepos(),
      log,
      "key",
    );

    expect(stagedRows().every((row) => row.externalId === CARD.id)).toBe(true);
  });

  it("skips ignored products and ignored variants", async () => {
    await refreshCardnexusPrices(
      makeFetch(),
      createMockRepos({ ignoredVariantKeys: [`${CARD.id}::normal::SC`] }),
      log,
      "key",
    );
    expect(stagedRows().map((row) => `${row.finish}/${row.language}`)).toEqual([
      "normal/EN",
      "foil/EN",
    ]);

    upsertSpy.mockClear();
    await refreshCardnexusPrices(
      makeFetch(),
      createMockRepos({ ignoredProductIds: [CARD.id] }),
      log,
      "key",
    );
    expect(stagedRows()).toEqual([]);
  });

  it("upserts expansions as groups", async () => {
    const repos = createMockRepos();

    const result = await refreshCardnexusPrices(makeFetch(), repos, log, "key");

    expect(repos.priceRefresh.upsertGroups).toHaveBeenCalledWith("cardnexus", [
      { groupId: 1124, name: "Origins - Main Set", abbreviation: "OGN" },
    ]);
    expect(result.transformed).toEqual({ groups: 1, products: 1, prices: 3 });
    expect(repos.marketplace.refreshLatestPrices).toHaveBeenCalled();
  });

  it("binds each finish through its own TCGplayer id and each language to its sibling", async () => {
    const repos = createMockRepos({
      existingSources: [
        {
          marketplace: "tcgplayer",
          externalId: 652_771,
          printingId: "p-normal-en",
          finish: "normal",
          language: null,
        },
        {
          marketplace: "tcgplayer",
          externalId: 652_772,
          printingId: "p-foil-en",
          finish: "foil",
          language: null,
        },
      ],
      printings: [
        { id: "p-normal-en", finish: "normal", language: "EN" },
        { id: "p-normal-sc", finish: "normal", language: "SC" },
        { id: "p-foil-en", finish: "foil", language: "EN" },
      ],
    });

    await refreshCardnexusPrices(makeFetch(), repos, log, "key");

    const inserted = vi
      .mocked(repos.priceRefresh.batchInsertProductVariants)
      .mock.calls.flatMap(([batch]) => batch);
    expect(inserted.map((v) => [v.marketplace, v.finish, v.language, v.printingId])).toEqual([
      ["cardnexus", "normal", "EN", "p-normal-en"],
      ["cardnexus", "normal", "SC", "p-normal-sc"],
      ["cardnexus", "foil", "EN", "p-foil-en"],
    ]);
  });

  it("falls back to the Cardmarket id when no TCGplayer id resolves", async () => {
    const repos = createMockRepos({
      existingSources: [
        {
          marketplace: "cardmarket",
          externalId: 845_712,
          printingId: "p-foil-en",
          finish: "foil",
          language: null,
        },
      ],
      printings: [{ id: "p-foil-en", finish: "foil", language: "EN" }],
    });

    await refreshCardnexusPrices(makeFetch(), repos, log, "key");

    const inserted = vi
      .mocked(repos.priceRefresh.batchInsertProductVariants)
      .mock.calls.flatMap(([batch]) => batch);
    expect(inserted.map((v) => v.printingId)).toEqual(["p-foil-en"]);
  });

  it("throws when a feed has not been generated", async () => {
    await expect(
      refreshCardnexusPrices(makeFetch({ missingFeed: "prices" }), createMockRepos(), log, "key"),
    ).rejects.toThrow("CardNexus has not generated every Riftbound feed yet");
  });

  it("throws on a failed feed download", async () => {
    const fetchFn = vi.fn<Fetch>(async () => new Response("nope", { status: 500 }));

    await expect(refreshCardnexusPrices(fetchFn, createMockRepos(), log, "key")).rejects.toThrow(
      "HTTP 500",
    );
  });
});
