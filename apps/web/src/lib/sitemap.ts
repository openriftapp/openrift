// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { chunk } from "@openrift/shared/collections";
import type { ErrataListResponse } from "@openrift/shared/contracts/errata";
import type { SitemapDataResponse } from "@openrift/shared/types/api/catalog";

import type { MetaEra } from "@/features/meta/lib/meta-scope";
import { VALID_RULE_KINDS } from "@/features/rules/lib/rules-kinds";
import type { HelpArticle } from "@/lib/help-article";

export const SITEMAP_FILE_LIMIT = 40_000;

export const SITEMAP_INDEX_PATH = "/sitemap.xml";

const SECTION_PATH = /^\/sitemap-(?<section>[a-z-]+?)(?:-(?<index>\d+))?\.xml$/u;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const CHANGELOG_DATE_HEADING = /^## (?<date>\d{4}-\d{2}-\d{2})\s*$/gmu;

const STATIC_PATHS = [
  "/",
  "/cards",
  "/sets",
  "/products",
  "/promos/EN",
  "/errata",
  "/meta",
  "/meta/events",
  "/meta/decks",
  "/meta/legends",
  "/rules",
  "/help",
  "/changelog",
  "/developers",
  "/legal-notice",
  "/privacy-policy",
];

/** `lastmod` is `YYYY-MM-DD`, absent where the page's content carries no date of its own. */
export interface SitemapUrl {
  path: string;
  search?: string;
  lastmod?: string;
}

export interface SitemapInput {
  siteUrl: string;
  changelogDate?: string;
  errataDate?: string;
  data: SitemapDataResponse;
  eras: readonly MetaEra[];
  helpArticles: readonly HelpArticle[];
}

const SECTIONS = ["site", "meta-events", "meta-decks", "meta-legends", "meta-players"] as const;

export type SitemapSection = (typeof SECTIONS)[number];

function isSection(value: string): value is SitemapSection {
  return (SECTIONS as readonly string[]).includes(value);
}

function newest(dates: readonly (string | null | undefined)[]): string | undefined {
  let result: string | undefined;
  for (const date of dates) {
    if (date !== null && date !== undefined && (result === undefined || date > result)) {
      result = date;
    }
  }
  return result;
}

function rulesVersionDate(version: string): string | undefined {
  return DATE_PATTERN.test(version) ? version : undefined;
}

export function latestChangelogDate(markdown: string): string | undefined {
  return newest([...markdown.matchAll(CHANGELOG_DATE_HEADING)].map((match) => match.groups?.date));
}

export function latestErrataDate(errata: ErrataListResponse): string | undefined {
  return newest([
    ...errata.announcements.map((announcement) => announcement.publishedOn),
    ...errata.entries.map((entry) => entry.effectiveDate),
  ]);
}

function rulesDate(data: SitemapDataResponse, kind?: string): string | undefined {
  return newest(
    data.rules
      .filter((entry) => kind === undefined || entry.kind === kind)
      .map((entry) => rulesVersionDate(entry.version)),
  );
}

function staticLastmod(path: string, input: SitemapInput): string | undefined {
  switch (path) {
    case "/changelog": {
      return input.changelogDate;
    }
    case "/errata": {
      return input.errataDate;
    }
    case "/rules": {
      return rulesDate(input.data);
    }
    default: {
      return undefined;
    }
  }
}

function entryUrls(prefix: string, entries: SitemapDataResponse["cards"]): SitemapUrl[] {
  return entries.map((entry) => ({
    path: `${prefix}/${entry.slug}`,
    lastmod: entry.updatedAt.slice(0, 10),
  }));
}

function siteUrls(input: SitemapInput): SitemapUrl[] {
  const { data, helpArticles } = input;
  return [
    ...STATIC_PATHS.map((path) => ({ path, lastmod: staticLastmod(path, input) })),
    ...helpArticles
      .filter((article) => !article.featureFlag)
      .map((article) => ({ path: `/help/${article.slug}` })),
    ...[...VALID_RULE_KINDS].map((kind) => ({
      path: `/rules/${kind}`,
      lastmod: rulesDate(data, kind),
    })),
    ...data.rules.map((entry) => ({
      path: `/rules/${entry.kind}/${entry.version}`,
      search: `lang=${entry.language}`,
      lastmod: rulesVersionDate(entry.version),
    })),
    ...entryUrls("/cards", data.cards),
    ...entryUrls("/sets", data.sets),
    ...entryUrls("/products", data.products),
  ];
}

function metaEventUrls({ data, eras }: SitemapInput): SitemapUrl[] {
  const eraIndexes: SitemapUrl[] = eras
    .slice(1)
    .map((era) => ({ path: "/meta/events", search: `era=${era.id}` }));
  return [...eraIndexes, ...entryUrls("/meta", data.metaEvents)];
}

const SECTION_URLS: Record<SitemapSection, (input: SitemapInput) => SitemapUrl[]> = {
  site: siteUrls,
  "meta-events": metaEventUrls,
  "meta-decks": ({ data }) => entryUrls("/meta/decks", data.metaDecks),
  "meta-legends": ({ data }) => entryUrls("/meta/legends", data.metaLegends),
  "meta-players": ({ data }) => entryUrls("/meta/players", data.metaPlayers),
};

export function sitemapSectionFiles(section: SitemapSection, input: SitemapInput): SitemapUrl[][] {
  const urls = SECTION_URLS[section](input);
  return chunk(urls, SITEMAP_FILE_LIMIT);
}

/** A section that fits one file keeps a bare name, so it never changes address if it later splits. */
export function sitemapFilePath(section: SitemapSection, index: number, count: number): string {
  return count > 1 ? `/sitemap-${section}-${index + 1}.xml` : `/sitemap-${section}.xml`;
}

export function parseSitemapPath(
  pathname: string,
): { section: SitemapSection; index: number } | null {
  const match = SECTION_PATH.exec(pathname);
  const section = match?.groups?.section;
  if (match === null || section === undefined || !isSection(section)) {
    return null;
  }
  const number = match.groups?.index === undefined ? 1 : Number(match.groups.index);
  if (number < 1) {
    return null;
  }
  return { section, index: number - 1 };
}

function lastmodTag(lastmod: string | undefined): string {
  return lastmod === undefined ? "" : `<lastmod>${lastmod}</lastmod>`;
}

export function renderSitemapIndex(input: SitemapInput): string {
  const entries: string[] = [];
  for (const section of SECTIONS) {
    const files = sitemapSectionFiles(section, input);
    files.forEach((urls, index) => {
      const lastmod = newest(urls.map((url) => url.lastmod));
      entries.push(
        `  <sitemap><loc>${input.siteUrl}${sitemapFilePath(section, index, files.length)}</loc>${lastmodTag(lastmod)}</sitemap>`,
      );
    });
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</sitemapindex>",
  ].join("\n");
}

function escapeXml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function sitemapLoc(siteUrl: string, { path, search }: SitemapUrl): string {
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return escapeXml(`${siteUrl}${encoded}${search === undefined ? "" : `?${search}`}`);
}

export function renderSitemapFile(
  section: SitemapSection,
  index: number,
  input: SitemapInput,
): string | null {
  const urls = sitemapSectionFiles(section, input)[index];
  if (urls === undefined) {
    return null;
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (url) =>
        `  <url><loc>${sitemapLoc(input.siteUrl, url)}</loc>${lastmodTag(url.lastmod)}</url>`,
    ),
    "</urlset>",
  ].join("\n");
}
