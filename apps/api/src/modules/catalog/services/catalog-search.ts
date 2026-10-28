import { cardSearchAltNames } from "@openrift/shared/card-name";
import type { CardSearchIndex } from "@openrift/shared/card-search";
import { buildCardIndex, findCard } from "@openrift/shared/card-search";
import type { SearchResponse } from "@openrift/shared/contracts/search";
import { SEARCH_PAGE_DEFAULT } from "@openrift/shared/contracts/search";
import { sortCards } from "@openrift/shared/filters-sort";
import { foldForSearch } from "@openrift/shared/search-fold";
import { bindSearchQuery } from "@openrift/shared/search-query/bind";
import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { compileQuery, sortByPreference } from "@openrift/shared/search-query/evaluate";
import type { SearchKeyId } from "@openrift/shared/search-query/keys";
import { formatSearchSlug } from "@openrift/shared/search-query/keys";
import type { ParsedSearchQuery, SearchDiagnostic } from "@openrift/shared/search-query/parse";
import { countQueryNodes, parseSearchQuery } from "@openrift/shared/search-query/parse";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";

const VIEWER_ONLY_KEYS: readonly SearchKeyId[] = ["price", "owned", "ctag"];

export const SEARCH_MAX_NODES = 64;

export interface CatalogSearchSource {
  catalog: CatalogResponse;
  printings: Printing[];
  formats: readonly { id: string; name: string }[];
  prices?: PriceLookup;
}

interface WireDiagnostic {
  code: string;
  severity: "warning" | "error";
  start: number;
  end: number;
  key?: string;
  value?: string;
}

interface Refusal {
  ok: false;
  diagnostics: WireDiagnostic[];
}

type CatalogSearchResult = { ok: true; response: SearchResponse } | Refusal;

export function queryReadsPrices(parsed: ParsedSearchQuery): boolean {
  return (
    parsed.directives.order === "price" ||
    parsed.directives.prefer === "usd-low" ||
    parsed.directives.prefer === "eur-low" ||
    parsed.clauses.some((clause) => clause.key === "usd" || clause.key === "eur")
  );
}

function searchVocabulary(source: CatalogSearchSource): SearchVocabulary {
  const { catalog } = source;
  const formatValues = source.formats.flatMap((format) => [
    formatSearchSlug(format.name),
    format.id,
  ]);
  const sets = catalog.sets.map((set) => set.slug);
  const languages = catalog.enums.languages.map((row) => row.slug);
  return {
    domain: catalog.enums.domains.map((row) => row.slug),
    rarity: catalog.enums.rarities.map((row) => row.slug),
    lang: languages,
    set: sets,
    in: [...sets, ...languages],
    marker: catalog.markers.map((marker) => marker.slug),
    channel: catalog.distributionChannels.map((channel) => channel.slug),
    format: formatValues,
    banned: formatValues,
  };
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

function isRefused(diagnostic: SearchDiagnostic): boolean {
  return diagnostic.severity === "error" || diagnostic.code === "unknownValue";
}

function parseCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) {
    return 0;
  }
  return /^\d+$/u.test(cursor) ? Number(cursor) : null;
}

function distinctPrintings(printings: Printing[], uniqueCards: boolean): Printing[] {
  const seen = new Set<string>();
  return printings.filter((printing) => {
    const key = uniqueCards ? printing.cardId : printing.printingId;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function matchCatalog(
  source: CatalogSearchSource,
  q: string,
): { ok: true; printings: Printing[] } | Refusal {
  const parsed = parseSearchQuery(q);
  if (countQueryNodes(parsed.root) > SEARCH_MAX_NODES) {
    return {
      ok: false,
      diagnostics: [{ code: "tooComplex", severity: "error", start: 0, end: q.length }],
    };
  }
  const refused = [
    ...parsed.diagnostics,
    ...bindSearchQuery(parsed, searchVocabulary(source), VIEWER_ONLY_KEYS),
  ].filter((diagnostic) => isRefused(diagnostic));
  if (refused.length > 0) {
    return { ok: false, diagnostics: refused.map((diagnostic) => toWire(diagnostic)) };
  }

  const { directives } = parsed;
  const predicate = compileQuery(parsed.root);
  const context = {
    priceLookup: source.prices,
    rarityOrder: source.catalog.enums.rarities.map((row) => row.slug),
  };
  const filtered = source.printings
    .filter((printing) => predicate(printing, context))
    .toSorted((a, b) => a.canonicalRank - b.canonicalRank);
  const preferred = directives.prefer
    ? sortByPreference(filtered, directives.prefer, source.prices)
    : filtered;
  const matched = distinctPrintings(preferred, directives.unique !== "prints");
  return {
    ok: true,
    printings: sortCards(matched, directives.order ?? "id", {
      sortDir: directives.direction,
      rarityOrder: context.rarityOrder,
      sets: source.catalog.sets,
      getPrice: (printing) => source.prices?.get(printing.printingId, "tcgplayer"),
    }),
  };
}

export function pageResponse(
  catalog: CatalogResponse,
  printings: readonly Printing[],
  offset: number,
  limit: number,
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
  };
}

export function runCatalogSearch(
  source: CatalogSearchSource,
  input: { q: string; cursor?: string; limit?: number },
): CatalogSearchResult {
  const offset = parseCursor(input.cursor);
  const matched = matchCatalog(source, input.q);
  if (!matched.ok || offset === null) {
    const diagnostics = matched.ok ? [] : matched.diagnostics;
    if (offset === null) {
      diagnostics.push({ code: "badCursor", severity: "error", start: 0, end: 0 });
    }
    return { ok: false, diagnostics };
  }
  return {
    ok: true,
    response: pageResponse(
      source.catalog,
      matched.printings,
      offset,
      input.limit ?? SEARCH_PAGE_DEFAULT,
    ),
  };
}

export function randomCard(
  source: CatalogSearchSource,
  q: string | undefined,
  random: () => number = Math.random,
): CatalogSearchResult | null {
  const matched = matchCatalog(source, q?.trim() ? q : "unique:cards");
  if (!matched.ok) {
    return matched;
  }
  if (matched.printings.length === 0) {
    return null;
  }
  const pick = matched.printings[Math.floor(random() * matched.printings.length)] as Printing;
  return { ok: true, response: pageResponse(source.catalog, [pick], 0, 1) };
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

export function namedCard(
  source: CatalogSearchSource,
  index: NamedCardIndex,
  input: { exact?: string; fuzzy?: string },
): SearchResponse | null {
  const cardId =
    input.exact === undefined
      ? input.fuzzy === undefined
        ? undefined
        : findCard(index.fuzzy, input.fuzzy)?.id
      : index.byFoldedName.get(foldForSearch(input.exact));
  if (cardId === undefined) {
    return null;
  }
  const printings = distinctPrintings(
    source.printings
      .filter((printing) => printing.cardId === cardId)
      .toSorted((a, b) => a.canonicalRank - b.canonicalRank),
    false,
  );
  return pageResponse(source.catalog, printings, 0, printings.length);
}
