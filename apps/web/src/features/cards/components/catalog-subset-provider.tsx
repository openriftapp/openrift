import type { DeckCatalogSubset } from "@openrift/shared/types/api/deck";
import type { ReactNode } from "react";

import { enrichCatalogSubset } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";

/**
 * Serves `useCards` from the slice of the catalogue a page already holds, so
 * nothing under it fetches or dehydrates the whole thing.
 */
export function CatalogSubsetProvider({
  catalog,
  children,
}: {
  catalog: DeckCatalogSubset;
  children: ReactNode;
}) {
  return (
    <CatalogSubsetContext value={enrichCatalogSubset(catalog)}>{children}</CatalogSubsetContext>
  );
}
