import { joinCatalog, joinCatalogCards, joinPrintingSides } from "@openrift/shared/catalog-join";
import { indexByPrinting, indexBySideKey } from "@openrift/shared/printing-side";
import type { CatalogPrintingsResponse, CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { DeckCatalogSubset } from "@openrift/shared/types/api/deck";
import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import type { QueryClient, UseSuspenseQueryOptions } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { preferredCatalogLanguages } from "@/features/cards/lib/catalog-languages";
import {
  consumeSeededCatalogVersion,
  seedCatalogVersion,
  versionFromEtag,
} from "@/features/cards/lib/catalog-version";
import type { GroupInfo } from "@/lib/card-group-types";
import { serverCacheKeys } from "@/lib/query-keys";
import { captureHandledError } from "@/lib/report-error";
import { serverCache } from "@/lib/server-cache";
import { apiErrorFromResponse, isRetryableError } from "@/lib/server-fns/api-error";
import { apiRequestHeaders } from "@/lib/server-fns/api-request-headers";
import { getApiUrl } from "@/lib/server-fns/api-url";

// Fetched with a plain `fetch`, not the oRPC client, so the ETag can be read
// off the same Response as the body.

async function fetchCatalogResponse(
  url: string,
  headers?: Record<string, string>,
): Promise<Response> {
  const res = await fetch(url, headers ? { headers } : undefined);
  if (!res.ok) {
    throw await apiErrorFromResponse(res, "Couldn't load catalog", { method: "GET", url });
  }
  return res;
}

export interface UseCardsResult {
  allPrintings: Printing[];
  cardsById: Record<string, Card>;
  printingsById: Record<string, Printing>;
  /** Side 1 under the bare printing id, side 2 under `<printingId>:2`. */
  printingsBySideKey: Record<string, Printing>;
  sidesByPrinting: Map<string, Printing[]>;
  printingsByCardId: Map<string, Printing[]>;
  sets: GroupInfo[];
}

// One serverCache entry holds both the catalog and its ETag so the token can
// never drift from the body it describes.
function fetchCatalogWithVersion(): Promise<{
  catalog: CatalogResponse;
  version: string | null;
}> {
  return serverCache.query({
    queryKey: serverCacheKeys.catalog,
    queryFn: async () => {
      const res = await fetchCatalogResponse(
        `${getApiUrl()}/api/v1/catalog`,
        // No cookie: the catalog is public.
        apiRequestHeaders(),
      );
      return {
        catalog: (await res.json()) as CatalogResponse,
        version: versionFromEtag(res.headers.get("etag")),
      };
    },
  });
}

// Do not route this through a per-request `context.queryClient`: it dehydrates to
// HTML and would inline the full ~310 KB catalog.
export async function readCatalogFromServerCache(): Promise<CatalogResponse> {
  const { catalog } = await fetchCatalogWithVersion();
  return catalog;
}

export async function readCatalogVersionFromServerCache(): Promise<string | null> {
  const { version } = await fetchCatalogWithVersion();
  return version;
}

const fetchCatalog = createServerFn({ method: "GET" }).handler((): Promise<CatalogResponse> =>
  readCatalogFromServerCache(),
);

// Goes through the Start server, not the edge, on purpose: the token must be
// fresh, and serverCache bounds origin load to one catalog fetch per minute.
const fetchCatalogVersion = createServerFn({ method: "GET" }).handler((): Promise<string | null> =>
  readCatalogVersionFromServerCache(),
);

/** The cached catalog: `partialLanguages` lists the only languages present until the tail merges. */
export interface CatalogEntry {
  catalog: CatalogResponse;
  version: string | null;
  partialLanguages: readonly string[] | null;
}

export function completeCatalogEntry(
  catalog: CatalogResponse,
  version: string | null = null,
): CatalogEntry {
  return { catalog, version, partialLanguages: null };
}

function normalizeCatalogLangs(langs: readonly string[]): string[] {
  return [...new Set(langs.map((lang) => lang.toUpperCase()))].sort();
}

export function ssrCatalogPreloadLangs(urlLanguages: readonly string[] | undefined): string[] {
  return normalizeCatalogLangs(
    urlLanguages && urlLanguages.length > 0 ? urlLanguages : PREFERENCE_DEFAULTS.languages,
  );
}

// Shared by the client fetch and the /cards SSR head's preload link, which
// MUST byte-match it (params in this order, same encoding) or the browser
// downloads the catalog twice.
export function catalogFetchUrl(
  origin: string,
  version: string | null,
  langs?: readonly string[],
): string {
  const params = new URLSearchParams();
  if (version !== null) {
    params.set("v", version);
  }
  if (langs !== undefined) {
    params.set("langs", langs.join(","));
  }
  const search = params.toString();
  const base = `${origin}/api/v1/catalog`;
  return search === "" ? base : `${base}?${search}`;
}

function catalogPrintingsUrl(
  origin: string,
  version: string | null,
  exceptLangs: readonly string[],
): string {
  const params = new URLSearchParams();
  if (version !== null) {
    params.set("v", version);
  }
  params.set("exceptLangs", exceptLangs.join(","));
  return `${origin}/api/v1/catalog/printings?${params.toString()}`;
}

// Detects a full response served for a variant request (deploy skew: an
// older API ignores `langs`). Exported for tests, not real module surface.
export function hasPrintingsOutside(catalog: CatalogResponse, langs: readonly string[]): boolean {
  const wanted = new Set(langs);
  for (const printing of Object.values(catalog.printings)) {
    if (!wanted.has(printing.language.toUpperCase())) {
      return true;
    }
  }
  return false;
}

// Fetches /api/v1/catalog directly (bypasses the Start server) so Cloudflare edge-caches it.
// `?v=<ETag>` must change with the catalog or max-age + stale-while-revalidate serves a stale body.
async function fetchCatalogFromEdge(
  client: QueryClient,
  langs: string[] | null,
): Promise<CatalogEntry> {
  const version = consumeSeededCatalogVersion() ?? (await fetchCatalogVersion().catch(() => null));
  const current = client.getQueryData<CatalogEntry>(catalogKeys.all);
  // The enrich memo depends on reference identity, so an unchanged complete catalog is kept.
  if (version !== null && current?.version === version && current.partialLanguages === null) {
    return current;
  }
  const url = catalogFetchUrl(globalThis.location.origin, version, langs ?? undefined);
  const res = await fetchCatalogResponse(url);
  const catalog = (await res.json()) as CatalogResponse;
  return {
    catalog,
    version: versionFromEtag(res.headers.get("etag")) ?? version,
    partialLanguages: langs !== null && !hasPrintingsOutside(catalog, langs) ? langs : null,
  };
}

class CatalogVersionSkewError extends Error {
  readonly servedVersion: string;

  constructor(servedVersion: string) {
    super("Catalog tail was served from another catalog version");
    this.name = "CatalogVersionSkewError";
    this.servedVersion = servedVersion;
  }
}

export function catalogTailQueryOptions(version: string | null, exceptLangs: readonly string[]) {
  return queryOptions({
    queryKey: catalogKeys.tail(version, exceptLangs),
    queryFn: async (): Promise<CatalogPrintingsResponse> => {
      const res = await fetchCatalogResponse(
        catalogPrintingsUrl(globalThis.location.origin, version, exceptLangs),
      );
      const servedVersion = versionFromEtag(res.headers.get("etag"));
      if (servedVersion !== null && version !== null && servedVersion !== version) {
        throw new CatalogVersionSkewError(servedVersion);
      }
      return (await res.json()) as CatalogPrintingsResponse;
    },
    staleTime: Infinity,
    retry: (failureCount, error) =>
      !(error instanceof CatalogVersionSkewError) && isRetryableError(error) && failureCount < 3,
  });
}

export async function ensureCatalogComplete(queryClient: QueryClient): Promise<void> {
  const entry = queryClient.getQueryData<CatalogEntry>(catalogKeys.all);
  if (!entry?.partialLanguages) {
    return;
  }
  let tail: CatalogPrintingsResponse;
  try {
    tail = await queryClient.query(catalogTailQueryOptions(entry.version, entry.partialLanguages));
  } catch (error) {
    if (error instanceof CatalogVersionSkewError) {
      // The server's version token lags a new catalog by up to its cache lifetime,
      // so the refetch asks for the version the tail came from.
      seedCatalogVersion(error.servedVersion);
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all, exact: true });
    } else {
      captureHandledError(error, { query: "catalog-tail" });
    }
    return;
  }
  queryClient.setQueryData<CatalogEntry>(catalogKeys.all, (current) =>
    current === entry
      ? completeCatalogEntry(
          { ...entry.catalog, printings: { ...entry.catalog.printings, ...tail.printings } },
          entry.version,
        )
      : current,
  );
}

// Memoized: the enriched result's `Map` (`printingsByCardId`) is not
// serializable, defeating React Query's structural sharing across renders.
const enrichCache = new WeakMap<CatalogResponse, UseCardsResult>();

function selectCards(entry: CatalogEntry): UseCardsResult {
  return enrichCatalog(entry.catalog);
}

export function enrichCatalog(catalog: CatalogResponse): UseCardsResult {
  const cached = enrichCache.get(catalog);
  if (cached) {
    return cached;
  }
  const result = enrichCatalogInner(catalog);
  enrichCache.set(catalog, result);
  return result;
}

function enrichCatalogInner(catalog: CatalogResponse): UseCardsResult {
  const { cardsById, printings } = joinCatalog(catalog);
  return buildCardsResult(cardsById, printings, catalog.sets);
}

export function buildCardsResult(
  cardsById: Record<string, Card>,
  allPrintings: Printing[],
  sets: CatalogResponse["sets"],
): UseCardsResult {
  const printingsById = Object.fromEntries(indexByPrinting(allPrintings));
  const sidesByPrinting = new Map(
    [...Map.groupBy(allPrintings, (p) => p.printingId)].map(([id, sides]) => [
      id,
      sides.toSorted((a, b) => a.side - b.side),
    ]),
  );

  return {
    allPrintings,
    cardsById,
    printingsById,
    printingsBySideKey: indexBySideKey(allPrintings),
    sidesByPrinting,
    printingsByCardId: Map.groupBy(allPrintings, (p) => p.cardId),
    sets,
  };
}

const enrichSubsetCache = new WeakMap<DeckCatalogSubset, UseCardsResult>();

export function enrichCatalogSubset(subset: DeckCatalogSubset): UseCardsResult {
  const cached = enrichSubsetCache.get(subset);
  if (cached) {
    return cached;
  }
  const cardsById = joinCatalogCards(subset.cards);
  const result = buildCardsResult(
    cardsById,
    joinPrintingSides(subset.printings, subset.sets, cardsById),
    subset.sets,
  );
  enrichSubsetCache.set(subset, result);
  return result;
}

const NO_CATALOG: CatalogResponse = {
  sets: [],
  cards: {},
  printings: {},
  markers: [],
  distributionChannels: [],
  enums: {
    cardTypes: [],
    superTypes: [],
    domains: [],
    rarities: [],
    finishes: [],
    artVariants: [],
    cardSizes: [],
    languages: [],
  },
  keywords: {},
  tagCategories: [],
  tagCategoryMap: {},
};

const NO_CATALOG_ENTRY = completeCatalogEntry(NO_CATALOG);

// A resolved stand-in so the unconditional useSuspenseQuery below never fetches or suspends.
export const noCatalogQueryOptions: UseSuspenseQueryOptions<CatalogEntry, Error, UseCardsResult> = {
  queryKey: catalogKeys.none,
  queryFn: () => NO_CATALOG_ENTRY,
  initialData: NO_CATALOG_ENTRY,
  staleTime: Infinity,
  select: selectCards,
};

// Exported for tests; not part of the module's real surface.
export function primaryCatalogLanguages(): string[] | null {
  let urlLanguages: string[] = [];
  try {
    const raw = new URLSearchParams(globalThis.location.search).get("languages");
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        urlLanguages = parsed.filter((entry): entry is string => typeof entry === "string");
      }
    }
  } catch {
    // Malformed param: contributes nothing, the router's search validation owns erroring.
  }
  // /promos/<language> may render a language outside the user's preferences.
  const promosLanguage = /^\/promos\/(?<lang>[A-Za-z]{2})(?:\/|$)/u.exec(
    globalThis.location.pathname,
  )?.groups?.lang;
  if (promosLanguage !== undefined) {
    urlLanguages.push(promosLanguage);
  }
  const base = urlLanguages.length > 0 ? urlLanguages : preferredCatalogLanguages();
  const merged = normalizeCatalogLangs(base);
  return merged.length > 0 ? merged : null;
}

export const catalogQueryOptions = queryOptions({
  queryKey: catalogKeys.all,
  queryFn: async ({ client }): Promise<CatalogEntry> =>
    globalThis.window === undefined
      ? completeCatalogEntry(await fetchCatalog())
      : fetchCatalogFromEdge(client, primaryCatalogLanguages()),
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
  // Entry identity carries the enrich memo and the tail merge's staleness check.
  structuralSharing: false,
  select: selectCards,
  retry: 1,
  retryDelay: 500,
});
