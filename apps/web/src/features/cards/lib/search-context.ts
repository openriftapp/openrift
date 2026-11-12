import type { CardSearchContext } from "@openrift/shared/filters-shared";
import { cardSearchContext } from "@openrift/shared/filters-shared";
import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { catalogSearchVocabulary } from "@openrift/shared/search-query/vocabulary";
import type { InitResponse } from "@openrift/shared/types/api/init";
import type { Printing } from "@openrift/shared/types/catalog";

import { buildTranslationReverseMap } from "@/features/cards/lib/keywords";

interface VocabularyCatalog {
  allPrintings: readonly Printing[];
  sets: readonly { slug: string; name: string }[];
}

/** Catalog-wide, not the page's filters, so `s:ven` matches nothing in a collection without Vendetta. */
export function catalogVocabulary(
  catalog: VocabularyCatalog,
  init: Pick<InitResponse, "enums">,
): SearchVocabulary {
  return catalogSearchVocabulary({
    printings: catalog.allPrintings,
    sets: catalog.sets,
    formats: (init.enums.formats ?? []).map((row) => ({ id: row.slug, name: row.label })),
    enums: {
      domains: init.enums.domains,
      rarities: init.enums.rarities,
      languages: init.enums.languages,
    },
  });
}

function rarityOrderOf(init: Pick<InitResponse, "enums">): string[] {
  return (init.enums.rarities ?? [])
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => row.slug);
}

type SsrSearchParts = Pick<CardSearchContext, "vocabulary" | "keywordReverseMap" | "rarityOrder">;

// Keyed by the server-cache objects, so one render's three server functions share one build.
const ssrPartsCache = new WeakMap<object, WeakMap<object, SsrSearchParts>>();

function ssrSearchParts(
  catalog: VocabularyCatalog,
  init: Pick<InitResponse, "enums" | "keywords">,
): SsrSearchParts {
  let byInit = ssrPartsCache.get(catalog);
  if (!byInit) {
    byInit = new WeakMap();
    ssrPartsCache.set(catalog, byInit);
  }
  let parts = byInit.get(init);
  if (!parts) {
    parts = {
      vocabulary: catalogVocabulary(catalog, init),
      keywordReverseMap: buildTranslationReverseMap(init.keywords),
      rarityOrder: rarityOrderOf(init),
    };
    byInit.set(init, parts);
  }
  return parts;
}

const preloadPrintingsCache = new WeakMap<readonly Printing[], Map<string, Printing[]>>();

function preloadPrintings(
  printings: readonly Printing[],
  preloadLangs: readonly string[],
): Printing[] {
  let byLangs = preloadPrintingsCache.get(printings);
  if (!byLangs) {
    byLangs = new Map();
    preloadPrintingsCache.set(printings, byLangs);
  }
  const key = preloadLangs.join(",");
  let kept = byLangs.get(key);
  if (!kept) {
    const wanted = new Set(preloadLangs);
    kept = printings.filter((printing) => wanted.has(printing.language.toUpperCase()));
    byLangs.set(key, kept);
  }
  return kept;
}

/**
 * Free text searches only the printings in `preloadLangs`, the client's first catalog load,
 * so the hydrating client reproduces the server's results.
 */
export function ssrCardSearchContext(
  catalog: VocabularyCatalog,
  init: Pick<InitResponse, "enums" | "keywords">,
  prices: Pick<CardSearchContext, "getPrice" | "priceLookup">,
  preloadLangs: readonly string[],
): CardSearchContext {
  const { vocabulary, keywordReverseMap, rarityOrder } = ssrSearchParts(catalog, init);
  return cardSearchContext({
    vocabulary,
    keywordReverseMap,
    customTagAssignments: undefined,
    rarityOrder,
    searchablePrintings: preloadPrintings(catalog.allPrintings, preloadLangs),
    ...prices,
  });
}
