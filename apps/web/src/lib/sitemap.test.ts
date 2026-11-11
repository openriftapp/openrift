import type { ErrataListResponse } from "@openrift/shared/contracts/errata";
import type { SitemapDataResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import type { HelpArticle } from "./help-article";
import type { SitemapInput } from "./sitemap";
import {
  latestChangelogDate,
  latestErrataDate,
  parseSitemapPath,
  renderSitemapFile,
  renderSitemapIndex,
  SITEMAP_FILE_LIMIT,
  sitemapFilePath,
  sitemapSectionFiles,
} from "./sitemap";

function entries(prefix: string, count: number): SitemapDataResponse["cards"] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `${prefix}-${index}`,
    updatedAt: "2026-08-01T12:00:00.000Z",
  }));
}

function input(overrides: Partial<SitemapInput> = {}): SitemapInput {
  return {
    siteUrl: "https://example.test",
    changelogDate: "2026-11-10",
    errataDate: "2026-07-23",
    helpArticles: [
      { slug: "getting-started" },
      { slug: "flagged-article", featureFlag: "someFlag" },
    ] as unknown as HelpArticle[],
    eras: [
      { id: "vendetta", label: "Vendetta", from: "2026-08-01", to: null },
      { id: "origins", label: "Origins", from: "2026-01-01", to: "2026-07-31" },
    ],
    data: {
      cards: entries("card", 2),
      sets: entries("set", 1),
      products: [],
      metaEvents: [{ slug: "rq-barcelona", updatedAt: "2026-08-26T10:00:00.000Z" }],
      metaDecks: [{ slug: "aB3dE5gH7jK9", updatedAt: "2026-08-27T10:00:00.000Z" }],
      metaLegends: [{ slug: "kennen-heart-of-the-tempest", updatedAt: "2026-08-28T10:00:00.000Z" }],
      metaPlayers: [{ slug: "u364017", updatedAt: "2026-08-29T10:00:00.000Z" }],
      rules: [
        {
          kind: "core",
          language: "en",
          version: "2026-07-16",
          updatedAt: "2026-07-17T10:00:00.000Z",
        },
        {
          kind: "core",
          language: "fr",
          version: "2026-07-16",
          updatedAt: "2026-10-02T10:00:00.000Z",
        },
      ],
    },
    ...overrides,
  };
}

const locs = (xml: string) =>
  [...xml.matchAll(/<loc>(?<url>[^<]+)<\/loc>/gu)].map((match) => match.groups?.url);

describe("renderSitemapIndex", () => {
  it("points at one file per section that holds anything", () => {
    const xml = renderSitemapIndex(input());
    expect(xml).toContain("<sitemapindex");
    expect(locs(xml)).toEqual([
      "https://example.test/sitemap-site.xml",
      "https://example.test/sitemap-meta-events.xml",
      "https://example.test/sitemap-meta-decks.xml",
      "https://example.test/sitemap-meta-legends.xml",
      "https://example.test/sitemap-meta-players.xml",
    ]);
  });

  it("dates each file by its newest entry", () => {
    const xml = renderSitemapIndex(input());
    expect(xml).toContain("sitemap-meta-decks.xml</loc><lastmod>2026-08-27</lastmod>");
  });

  it("numbers the files of a section that outgrows one", () => {
    const xml = renderSitemapIndex(
      input({ data: { ...input().data, metaDecks: entries("deck", SITEMAP_FILE_LIMIT + 1) } }),
    );
    expect(locs(xml)).toContain("https://example.test/sitemap-meta-decks-1.xml");
    expect(locs(xml)).toContain("https://example.test/sitemap-meta-decks-2.xml");
    expect(locs(xml)).not.toContain("https://example.test/sitemap-meta-decks.xml");
  });
});

describe("sitemapSectionFiles", () => {
  it("fills a file to the limit before opening the next", () => {
    const files = sitemapSectionFiles(
      "meta-decks",
      input({ data: { ...input().data, metaDecks: entries("deck", SITEMAP_FILE_LIMIT + 1) } }),
    );
    expect(files.map((file) => file.length)).toEqual([SITEMAP_FILE_LIMIT, 1]);
  });

  it("holds the static pages, help, rules, cards, sets and products in the site file", () => {
    const [file] = sitemapSectionFiles("site", input());
    const paths = file!.map((url) => url.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/meta/decks");
    expect(paths).toContain("/help/getting-started");
    expect(paths).not.toContain("/help/flagged-article");
    expect(paths).toContain("/rules/core");
    expect(paths).toContain("/cards/card-0");
    expect(paths).toContain("/sets/set-0");
  });

  it("lists the developers page", () => {
    const [file] = sitemapSectionFiles("site", input());
    expect(file!.map((url) => url.path)).toContain("/developers");
  });

  it("lists each language's latest rules version, dated by the version's published date", () => {
    const [file] = sitemapSectionFiles("site", input());
    const rules = file!.filter((url) => url.path === "/rules/core/2026-07-16");
    expect(rules.map((url) => [url.search, url.lastmod])).toEqual([
      ["lang=en", "2026-07-16"],
      ["lang=fr", "2026-07-16"],
    ]);
  });

  it("dates pages by their content's own dates and leaves the rest undated", () => {
    const [file] = sitemapSectionFiles("site", input());
    const lastmods = Object.fromEntries(file!.map((url) => [url.path, url.lastmod]));
    expect(lastmods["/changelog"]).toBe("2026-11-10");
    expect(lastmods["/errata"]).toBe("2026-07-23");
    expect(lastmods["/rules"]).toBe("2026-07-16");
    expect(lastmods["/rules/core"]).toBe("2026-07-16");
    expect(lastmods["/cards/card-0"]).toBe("2026-08-01");
    for (const path of [
      "/",
      "/cards",
      "/meta",
      "/help",
      "/help/getting-started",
      "/legal-notice",
    ]) {
      expect(lastmods[path]).toBeUndefined();
    }
    expect("/rules/tournament" in lastmods).toBe(true);
    expect(lastmods["/rules/tournament"]).toBeUndefined();
  });

  it("leaves a rules version that is not a date undated", () => {
    const base = input();
    const [file] = sitemapSectionFiles(
      "site",
      input({
        data: {
          ...base.data,
          rules: [{ ...base.data.rules[0]!, version: "draft" }],
        },
      }),
    );
    expect(file!.find((url) => url.path === "/rules/core/draft")?.lastmod).toBeUndefined();
  });
});

describe("latestChangelogDate", () => {
  it("reads the newest dated heading", () => {
    expect(
      latestChangelogDate(
        "# Changelog\n\n## 2026-11-03\n\n- a\n\n## 2026-11-10\n\n### Highlights\n",
      ),
    ).toBe("2026-11-10");
  });

  it("answers undefined without a dated heading", () => {
    expect(latestChangelogDate("# Changelog\n\n## Unreleased\n")).toBeUndefined();
  });
});

describe("latestErrataDate", () => {
  it("takes the newest announcement or effective date", () => {
    const errata = {
      announcements: [{ id: "a", name: "Vendetta Errata", publishedOn: "2026-07-23", url: "" }],
      sets: [],
      entries: [{ effectiveDate: "2026-08-02" }, { effectiveDate: null }],
    } as unknown as ErrataListResponse;
    expect(latestErrataDate(errata)).toBe("2026-08-02");
  });

  it("answers undefined for an empty errata list", () => {
    expect(latestErrataDate({ announcements: [], sets: [], entries: [] })).toBeUndefined();
  });
});

describe("sitemap entry set", () => {
  const allLocs = (value: SitemapInput) =>
    (["site", "meta-events", "meta-decks", "meta-legends", "meta-players"] as const).flatMap(
      (section) => locs(renderSitemapFile(section, 0, value) ?? ""),
    );

  it("lists exactly the URLs it listed before the lastmod and field changes", () => {
    expect(allLocs(input())).toEqual([
      "https://example.test/",
      "https://example.test/cards",
      "https://example.test/sets",
      "https://example.test/products",
      "https://example.test/promos/EN",
      "https://example.test/errata",
      "https://example.test/meta",
      "https://example.test/meta/events",
      "https://example.test/meta/decks",
      "https://example.test/meta/legends",
      "https://example.test/rules",
      "https://example.test/help",
      "https://example.test/changelog",
      "https://example.test/developers",
      "https://example.test/legal-notice",
      "https://example.test/privacy-policy",
      "https://example.test/help/getting-started",
      "https://example.test/rules/core",
      "https://example.test/rules/tournament",
      "https://example.test/rules/core/2026-07-16?lang=en",
      "https://example.test/rules/core/2026-07-16?lang=fr",
      "https://example.test/cards/card-0",
      "https://example.test/cards/card-1",
      "https://example.test/sets/set-0",
      "https://example.test/meta/events?era=origins",
      "https://example.test/meta/rq-barcelona",
      "https://example.test/meta/decks/aB3dE5gH7jK9",
      "https://example.test/meta/legends/kennen-heart-of-the-tempest",
      "https://example.test/meta/players/u364017",
    ]);
  });

  it("renders byte-identical files from two loads of the same data", () => {
    for (const section of ["site", "meta-events", "meta-players"] as const) {
      expect(renderSitemapFile(section, 0, input())).toBe(renderSitemapFile(section, 0, input()));
    }
    expect(renderSitemapIndex(input())).toBe(renderSitemapIndex(input()));
  });
});

describe("renderSitemapFile", () => {
  it("renders each url with only a loc and a date-only lastmod", () => {
    const xml = renderSitemapFile("meta-events", 0, input());
    expect(xml).toContain(
      "<url><loc>https://example.test/meta/rq-barcelona</loc><lastmod>2026-08-26</lastmod></url>",
    );
    expect(xml).toContain("<url><loc>https://example.test/meta/events?era=origins</loc></url>");
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });

  it("lists the older eras' index views beside the events", () => {
    const xml = renderSitemapFile("meta-events", 0, input());
    expect(locs(xml ?? "")).toEqual([
      "https://example.test/meta/events?era=origins",
      "https://example.test/meta/rq-barcelona",
    ]);
  });

  it("lists legend and player pages", () => {
    expect(locs(renderSitemapFile("meta-legends", 0, input()) ?? "")).toEqual([
      "https://example.test/meta/legends/kennen-heart-of-the-tempest",
    ]);
    expect(locs(renderSitemapFile("meta-players", 0, input()) ?? "")).toEqual([
      "https://example.test/meta/players/u364017",
    ]);
  });

  it("percent-encodes player names that carry markup, ampersands or non-ASCII", () => {
    const xml = renderSitemapFile(
      "meta-players",
      0,
      input({
        data: {
          ...input().data,
          metaPlayers: [
            { slug: "pn<猫岛巡礼>水鬼", updatedAt: "2026-09-02T10:00:00.000Z" },
            { slug: "pn>_<", updatedAt: "2026-09-02T10:00:00.000Z" },
            { slug: "pn神切&成年拆 #1?", updatedAt: "2026-09-02T10:00:00.000Z" },
          ],
        },
      }),
    );
    expect(locs(xml ?? "")).toEqual([
      "https://example.test/meta/players/pn%3C%E7%8C%AB%E5%B2%9B%E5%B7%A1%E7%A4%BC%3E%E6%B0%B4%E9%AC%BC",
      "https://example.test/meta/players/pn%3E_%3C",
      "https://example.test/meta/players/pn%E7%A5%9E%E5%88%87%26%E6%88%90%E5%B9%B4%E6%8B%86%20%231%3F",
    ]);
  });

  it("answers null for a file the section does not have", () => {
    expect(renderSitemapFile("meta-events", 1, input())).toBeNull();
  });
});

describe("parseSitemapPath", () => {
  it("reads a bare section file as its first file", () => {
    expect(parseSitemapPath("/sitemap-meta-decks.xml")).toEqual({
      section: "meta-decks",
      index: 0,
    });
  });

  it("reads a numbered file", () => {
    expect(parseSitemapPath("/sitemap-meta-decks-2.xml")).toEqual({
      section: "meta-decks",
      index: 1,
    });
  });

  it("rejects anything that is not a section file", () => {
    expect(parseSitemapPath("/sitemap.xml")).toBeNull();
    expect(parseSitemapPath("/sitemap-unknown.xml")).toBeNull();
    expect(parseSitemapPath("/sitemap-site-0.xml")).toBeNull();
  });
});

describe("sitemapFilePath", () => {
  it("keeps a bare name until a section splits", () => {
    expect(sitemapFilePath("site", 0, 1)).toBe("/sitemap-site.xml");
    expect(sitemapFilePath("meta-decks", 1, 3)).toBe("/sitemap-meta-decks-2.xml");
  });
});
