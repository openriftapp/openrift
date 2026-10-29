import { cardSearchAltNames } from "@openrift/shared/card-name";
import type { CardSearchIndex } from "@openrift/shared/card-search";
import { buildCardIndex, resolveCard } from "@openrift/shared/card-search";
import type { SearchResponse } from "@openrift/shared/contracts/search";
import { SEARCH_PAGE_DEFAULT } from "@openrift/shared/contracts/search";
import { sortCards } from "@openrift/shared/filters-sort";
import { foldForSearch } from "@openrift/shared/search-fold";
import { resolveSearchQuery } from "@openrift/shared/search-query/bind";
import { compileQuery, sortByPreference } from "@openrift/shared/search-query/evaluate";
import type { SearchKeyId, SearchOrder } from "@openrift/shared/search-query/keys";
import { resolveDirection } from "@openrift/shared/search-query/keys";
import type {
  ParsedSearchQuery,
  SearchDiagnostic,
  SearchDirectives,
} from "@openrift/shared/search-query/parse";
import {
  countQueryNodes,
  parseSearchQuery,
  pruneIgnored,
} from "@openrift/shared/search-query/parse";
import { catalogSearchVocabulary } from "@openrift/shared/search-query/vocabulary";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import { describeSearchDiagnostic } from "../lib/search-messages.js";

const VIEWER_ONLY_KEYS: readonly SearchKeyId[] = ["price", "owned", "ctag"];

const IGNORED_CODES: ReadonlySet<SearchDiagnostic["code"]> = new Set([
  "unknownKey",
  "unknownValue",
  "ambiguousValue",
]);

export const SEARCH_MAX_NODES = 64;

export interface CatalogSearchSource {
  catalog: CatalogResponse;
  printings: Printing[];
  formats: readonly { id: string; name: string }[];
  prices?: PriceLookup;
}

export interface CatalogSearchInput {
  q: string;
  unique?: NonNullable<SearchDirectives["unique"]>;
  order?: SearchOrder;
  dir?: NonNullable<SearchDirectives["direction"]>;
  cursor?: string;
  limit?: number;
}

interface WireDiagnostic {
  code: string;
  severity: "warning" | "error";
  start: number;
  end: number;
  key?: string;
  value?: string;
}

export type CatalogSearchFailure =
  | { ok: false; status: "badRequest"; diagnostics: WireDiagnostic[]; warnings: string[] }
  | { ok: false; status: "notFound"; warnings: string[] };

type CatalogSearchResult = { ok: true; response: SearchResponse } | CatalogSearchFailure;

export function queryReadsPrices(parsed: ParsedSearchQuery, order?: SearchOrder): boolean {
  const effective = parsed.directives.order ?? order;
  return (
    effective === "price" ||
    effective === "usd" ||
    effective === "eur" ||
    parsed.directives.prefer === "usd-low" ||
    parsed.directives.prefer === "eur-low" ||
    parsed.clauses.some((clause) =>
      ["usd", "eur", "usdfoil", "eurfoil"].includes(clause.key as string),
    )
  );
}

function toWire(diagnostic: SearchDiagnostic): WireDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    start: diagnostic.span.start,
    end: diagnostic.span.end,
    ...(diagnostic.key === undefined ? {} : { key: diagnostic.key }),
    ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
  };
}

function parseCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) {
    return 0;
  }
  return /^\d+$/u.test(cursor) ? Number(cursor) : null;
}

function uniqueKey(printing: Printing, unique: NonNullable<SearchDirectives["unique"]>): string {
  switch (unique) {
    case "cards": {
      return printing.cardId;
    }
    case "prints": {
      return printing.printingId;
    }
    // The catalog has no illustration id; one artist's one art variant of a card is one illustration.
    case "art": {
      return `${printing.cardId}|${printing.artist}|${printing.artVariant}`;
    }
  }
}

function distinctPrintings(
  printings: Printing[],
  unique: NonNullable<SearchDirectives["unique"]>,
): Printing[] {
  const seen = new Set<string>();
  return printings.filter((printing) => {
    const key = uniqueKey(printing, unique);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function inDefaultLanguage(printing: Printing): boolean {
  const english = WellKnown.language.EN;
  return printing.language === english || !(printing.cardLanguages ?? []).includes(english);
}

function badRequest(
  diagnostics: SearchDiagnostic[],
  warnings: string[],
  q: string,
): CatalogSearchFailure {
  return {
    ok: false,
    status: "badRequest",
    diagnostics: diagnostics.map((diagnostic) => toWire(diagnostic)),
    warnings: [
      ...diagnostics.map((diagnostic) => describeSearchDiagnostic(diagnostic, q)),
      ...warnings,
    ],
  };
}

function matchCatalog(
  source: CatalogSearchSource,
  input: Omit<CatalogSearchInput, "cursor" | "limit">,
): { ok: true; printings: Printing[]; warnings: string[] } | CatalogSearchFailure {
  const { q } = input;
  const parsed = parseSearchQuery(q);
  if (countQueryNodes(parsed.root) > SEARCH_MAX_NODES) {
    return {
      ok: false,
      status: "badRequest",
      diagnostics: [{ code: "tooComplex", severity: "error", start: 0, end: q.length }],
      warnings: [`The query has more than ${SEARCH_MAX_NODES} terms.`],
    };
  }
  const vocabulary = catalogSearchVocabulary({
    printings: source.printings,
    sets: source.catalog.sets,
    formats: source.formats,
    enums: {
      ...source.catalog.enums,
      markers: source.catalog.markers,
      channels: source.catalog.distributionChannels,
    },
  });
  const resolved = resolveSearchQuery(parsed, vocabulary, VIEWER_ONLY_KEYS);
  const errors = resolved.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = resolved.diagnostics
    .filter((diagnostic) => diagnostic.severity === "warning")
    .map((diagnostic) => describeSearchDiagnostic(diagnostic, q));
  if (errors.length > 0) {
    return badRequest(errors, warnings, q);
  }
  const root = pruneIgnored(resolved.root);
  if (
    parsed.root !== null &&
    root === null &&
    resolved.diagnostics.some((diagnostic) => IGNORED_CODES.has(diagnostic.code))
  ) {
    return {
      ok: false,
      status: "badRequest",
      diagnostics: [],
      warnings: ["All of your terms were ignored.", ...warnings],
    };
  }

  const { directives } = resolved;
  const unique = directives.unique ?? input.unique ?? "cards";
  const order = directives.order ?? input.order ?? "name";
  const predicate = compileQuery(root);
  const anyLanguage = resolved.clauses.some((clause) => clause.key === "lang");
  const context = {
    priceLookup: source.prices,
    rarityOrder: source.catalog.enums.rarities.map((row) => row.slug),
  };
  const filtered = source.printings
    .filter(
      (printing) => (anyLanguage || inDefaultLanguage(printing)) && predicate(printing, context),
    )
    .toSorted((a, b) => a.canonicalRank - b.canonicalRank);
  const preferred = directives.prefer
    ? sortByPreference(filtered, directives.prefer, source.prices)
    : filtered;
  const matched = distinctPrintings(preferred, unique);
  return {
    ok: true,
    warnings,
    printings: sortCards(matched, order === "price" ? "usd" : order, {
      sortDir: resolveDirection(order, directives.direction ?? input.dir),
      rarityOrder: context.rarityOrder,
      sets: source.catalog.sets,
      getMarketPrice: (printing, marketplace) =>
        source.prices?.get(printing.printingId, marketplace),
    }),
  };
}

function pageResponse(
  catalog: CatalogResponse,
  printings: readonly Printing[],
  offset: number,
  limit: number,
  warnings: string[],
): SearchResponse {
  const page = printings.slice(offset, offset + limit);
  const printingIds = page.map((printing) => printing.printingId);
  const cardIds = new Set(
    page.flatMap((printing) =>
      printing.otherSide ? [printing.cardId, printing.otherSide.cardId] : [printing.cardId],
    ),
  );
  const setIds = new Set(page.map((printing) => printing.setId));
  return {
    total: printings.length,
    nextCursor: offset + limit < printings.length ? String(offset + limit) : null,
    printingIds,
    printings: Object.fromEntries(
      printingIds.flatMap((id) => {
        const value = catalog.printings[id];
        return value ? [[id, value]] : [];
      }),
    ),
    cards: Object.fromEntries(
      [...cardIds].flatMap((id) => {
        const value = catalog.cards[id];
        return value ? [[id, value]] : [];
      }),
    ),
    sets: catalog.sets.filter((set) => setIds.has(set.id)),
    warnings,
  };
}

export function runCatalogSearch(
  source: CatalogSearchSource,
  input: CatalogSearchInput,
): CatalogSearchResult {
  const offset = parseCursor(input.cursor);
  if (offset === null) {
    return {
      ok: false,
      status: "badRequest",
      diagnostics: [{ code: "badCursor", severity: "error", start: 0, end: 0 }],
      warnings: ["The cursor is not one this endpoint returned."],
    };
  }
  const matched = matchCatalog(source, input);
  if (!matched.ok) {
    return matched;
  }
  if (matched.printings.length === 0) {
    return { ok: false, status: "notFound", warnings: matched.warnings };
  }
  return {
    ok: true,
    response: pageResponse(
      source.catalog,
      matched.printings,
      offset,
      input.limit ?? SEARCH_PAGE_DEFAULT,
      matched.warnings,
    ),
  };
}

export function randomCard(
  source: CatalogSearchSource,
  q: string | undefined,
  random: () => number = Math.random,
): CatalogSearchResult {
  const matched = matchCatalog(source, { q: q?.trim() ? q : "unique:cards" });
  if (!matched.ok) {
    return matched;
  }
  if (matched.printings.length === 0) {
    return { ok: false, status: "notFound", warnings: matched.warnings };
  }
  const pick = matched.printings[Math.floor(random() * matched.printings.length)] as Printing;
  return {
    ok: true,
    response: pageResponse(source.catalog, [pick], 0, 1, matched.warnings),
  };
}

export interface NamedCardIndex {
  fuzzy: CardSearchIndex<{ id: string; slug: string; name: string; altNames: string[] }>;
  byFoldedName: Map<string, string>;
}

export function buildNamedCardIndex(
  catalog: CatalogResponse,
  printings: Printing[],
): NamedCardIndex {
  const cards = Object.entries(catalog.cards).map(([id, card]) => ({
    id,
    slug: card.slug,
    name: card.name,
    altNames: cardSearchAltNames(card),
  }));
  const byFoldedName = new Map<string, string>();
  for (const card of cards) {
    for (const name of [card.name, ...card.altNames]) {
      byFoldedName.set(foldForSearch(name), card.id);
    }
  }
  return {
    fuzzy: buildCardIndex(
      cards,
      Map.groupBy(printings, (printing) => printing.cardId),
    ),
    byFoldedName,
  };
}

type NamedCardResult =
  | { ok: true; response: SearchResponse }
  | { ok: false; type: "not_found" | "ambiguous" };

function inSet(catalog: CatalogResponse, printing: Printing, set: string): boolean {
  const wanted = foldForSearch(set);
  const match = catalog.sets.find((entry) => entry.id === printing.setId);
  return (
    match !== undefined &&
    (foldForSearch(match.slug) === wanted || foldForSearch(match.name) === wanted)
  );
}

function fuzzyCardId(
  index: NamedCardIndex,
  query: string,
): { cardId: string } | { type: "not_found" | "ambiguous" } {
  const slug = index.fuzzy.bySlug.get(query.trim());
  if (slug) {
    return { cardId: slug.id };
  }
  const resolution = resolveCard(index.fuzzy, query);
  if (resolution.status === "matched") {
    return { cardId: resolution.card.id };
  }
  return { type: resolution.status === "ambiguous" ? "ambiguous" : "not_found" };
}

export function namedCard(
  source: CatalogSearchSource,
  index: NamedCardIndex,
  input: { exact?: string; fuzzy?: string; set?: string },
): NamedCardResult {
  let cardId: string | undefined;
  if (input.exact !== undefined) {
    cardId = index.byFoldedName.get(foldForSearch(input.exact));
  } else if (input.fuzzy !== undefined) {
    const found = fuzzyCardId(index, input.fuzzy);
    if ("type" in found) {
      return { ok: false, type: found.type };
    }
    cardId = found.cardId;
  }
  if (cardId === undefined) {
    return { ok: false, type: "not_found" };
  }
  const { set } = input;
  const printings = distinctPrintings(
    source.printings
      .filter(
        (printing) =>
          printing.cardId === cardId && (set === undefined || inSet(source.catalog, printing, set)),
      )
      .toSorted((a, b) => a.canonicalRank - b.canonicalRank),
    "prints",
  );
  if (printings.length === 0) {
    return { ok: false, type: "not_found" };
  }
  return {
    ok: true,
    response: pageResponse(source.catalog, printings, 0, printings.length, []),
  };
}
