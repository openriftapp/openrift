import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { catalogSearchVocabulary } from "@openrift/shared/search-query/vocabulary";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { initQueryOptions } from "@/lib/init-queries";

/**
 * Catalog-wide, not the page's filters, so `s:ven` matches nothing in a collection without Vendetta.
 * Never fetches the catalog.
 */
export function useCatalogSearchVocabulary(): SearchVocabulary | undefined {
  const subset = use(CatalogSubsetContext);
  const { data: cached } = useQuery({ ...catalogQueryOptions, enabled: false });
  const { data: init } = useSuspenseQuery(initQueryOptions);
  const catalog = subset ?? cached;
  if (!catalog) {
    return undefined;
  }
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
