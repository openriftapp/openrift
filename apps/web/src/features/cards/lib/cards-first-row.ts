import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { priceLookupFromMap } from "@openrift/shared/price-lookup";
import { sortByLanguageAndCanonicalRank } from "@openrift/shared/printing-select";
import { sideKey } from "@openrift/shared/printing-side";
import type { SearchOrder } from "@openrift/shared/search-query/keys";
import { resolveDirection } from "@openrift/shared/search-query/keys";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { InitResponse } from "@openrift/shared/types/api/init";
import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import type { PricesResponse } from "@openrift/shared/types/api/pricing";
import type { PrintingSide } from "@openrift/shared/types/catalog";
import type { GroupByField, SortDirection, SortOption } from "@openrift/shared/types/search";
import { createServerFn } from "@tanstack/react-start";

import { deriveCardGrid } from "@/features/cards/lib/card-grid-pipeline";
import { buildGroups } from "@/features/cards/lib/card-groups";
import { frontImageId } from "@/features/cards/lib/card-meta";
import {
  labelsFromInit,
  ordersFromInit,
  ssrSearchToFilters,
  SSR_MARKETPLACE,
} from "@/features/cards/lib/cards-facets";
import {
  enrichCatalog,
  readCatalogFromServerCache,
  ssrCatalogPreloadLangs,
} from "@/features/cards/lib/catalog-queries";
import { readPricesFromServerCache } from "@/features/cards/lib/prices-queries";
import { ssrCardSearchContext } from "@/features/cards/lib/search-context";
import type { FilterSearch } from "@/features/cards/lib/search-schemas";
import { needsCssRotation } from "@/lib/images";
import { readInitFromServerCache } from "@/lib/init-queries";
import { getShellCookie } from "@/lib/page-cache";
import type { SurfaceViewPrefs } from "@/lib/view-prefs";
import {
  resolveViewPrefsFromCookie,
  VIEW_PREFS_COOKIE,
  VIEW_SURFACE_CONFIGS,
} from "@/lib/view-prefs";

export interface FirstRowCard {
  printingId: string;
  side: PrintingSide;
  cardName: string;
  setSlug: string;
  imageId: string | null;
  rotated: boolean;
}

// Two full rows at the widest grid breakpoint (8 cols at >= 1920px). Narrower
// breakpoints trim overflow via per-breakpoint visibility classes instead.
const FIRST_ROW_LIMIT = 16;

// SSR can't read the user's `defaultCardView` / `languages` preferences
// (those live in localStorage); assume PREFERENCE_DEFAULTS instead so the
// dominant cold-nav case matches the hydrated grid.
const SSR_USER_LANGUAGES: readonly string[] = PREFERENCE_DEFAULTS.languages;
const SSR_DEFAULT_VIEW: "cards" | "printings" = "cards";

export interface FirstRowSources {
  catalog: CatalogResponse;
  init: Pick<InitResponse, "enums" | "keywords">;
  prices: PricesResponse;
}

export function extractFirstRow(
  { catalog, init, prices }: FirstRowSources,
  search: FilterSearch,
  limit: number,
  viewDefaults: SurfaceViewPrefs = VIEW_SURFACE_CONFIGS.cards.defaults,
): FirstRowCard[] {
  const directives = parseSearchQuery(search.q ?? "").directives;
  const requestedView =
    directives.unique === "prints" || directives.unique === "art" ? "printings" : search.view;
  const view =
    directives.unique === "cards"
      ? "cards"
      : requestedView === "printings"
        ? "printings"
        : SSR_DEFAULT_VIEW;
  const groupBy = (search.groupBy ?? viewDefaults.groupBy) as GroupByField;
  const groupDir: SortDirection =
    (search.groupDir ?? viewDefaults.groupDir) === "desc" ? "desc" : "asc";
  const sortBy: SearchOrder =
    directives.order ?? ((search.sort ?? viewDefaults.sort) as SortOption);
  const sortDir: SortDirection =
    directives.order === undefined && directives.direction === undefined
      ? (search.sortDir ?? viewDefaults.sortDir) === "desc"
        ? "desc"
        : "asc"
      : resolveDirection(sortBy, directives.direction);

  const enriched = enrichCatalog(catalog);
  const lookup = priceLookupFromMap(prices.prices);
  const { sortedCards } = deriveCardGrid({
    allPrintings: sortByLanguageAndCanonicalRank(enriched.allPrintings, SSR_USER_LANGUAGES),
    sets: enriched.sets,
    filters: ssrSearchToFilters(search),
    view,
    groupBy,
    sortBy,
    sortDir,
    context: ssrCardSearchContext(
      enriched,
      init,
      {
        getPrice: (printing) => lookup.get(printing.printingId, SSR_MARKETPLACE),
        priceLookup: lookup,
      },
      ssrCatalogPreloadLangs(search.languages),
    ),
    prices: lookup,
    favoriteMarketplace: SSR_MARKETPLACE,
  });

  const items = sortedCards.map((printing) => ({ id: sideKey(printing), printing }));
  const ordered = buildGroups(
    items,
    groupBy,
    enriched.sets,
    groupDir,
    ordersFromInit(init),
    labelsFromInit(init),
  ).flatMap((group) => group.items);

  const result: FirstRowCard[] = [];
  for (const { printing } of ordered) {
    if (result.length >= limit) {
      break;
    }
    const imageId = frontImageId(printing);
    result.push({
      printingId: printing.printingId,
      side: printing.side,
      cardName: legendDisplayName(printing.card),
      setSlug: printing.setSlug,
      imageId,
      rotated: needsCssRotation(getOrientation(printing.card.types)),
    });
  }
  return result;
}

export const fetchFirstRowCards = createServerFn({ method: "GET" })
  .validator((input: FilterSearch) => input)
  .handler(async ({ data }): Promise<FirstRowCard[]> => {
    const [catalog, init, prices] = await Promise.all([
      readCatalogFromServerCache(),
      readInitFromServerCache(),
      readPricesFromServerCache(),
    ]);
    // Same cookie the hydrated grid resolves its defaults from.
    const viewPrefs = resolveViewPrefsFromCookie(getShellCookie(VIEW_PREFS_COOKIE));
    return extractFirstRow({ catalog, init, prices }, data, FIRST_ROW_LIMIT, viewPrefs.cards);
  });
