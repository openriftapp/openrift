import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { catalogVocabulary } from "@/features/cards/lib/search-context";
import { initQueryOptions } from "@/lib/init-queries";

export function useCatalogSearchVocabulary(): SearchVocabulary | undefined {
  const subset = use(CatalogSubsetContext);
  const { data: cached } = useQuery({ ...catalogQueryOptions, enabled: false });
  const { data: init } = useSuspenseQuery(initQueryOptions);
  const catalog = subset ?? cached;
  if (!catalog) {
    return undefined;
  }
  return catalogVocabulary(catalog, init);
}
