import type { StandardArtFallback } from "@openrift/shared/standard";
import type { Printing } from "@openrift/shared/types/catalog";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";

import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { standardArtFallback } from "@/features/cards/lib/tile-art";

export type GetStandardArtFallback = (printing: Printing) => StandardArtFallback | null;

/**
 * `enabled: false`: reads the catalog only if another surface already fetched it,
 * else the slice a page provides through `CatalogSubsetContext`.
 */
export function useStandardArtFallback(): GetStandardArtFallback {
  "use memo";
  const subset = use(CatalogSubsetContext);
  const { data } = useQuery({ ...catalogQueryOptions, enabled: false });
  const printingsByCardId = (data ?? subset)?.printingsByCardId;
  return function getStandardArtFallback(printing: Printing): StandardArtFallback | null {
    return standardArtFallback(printing, printingsByCardId);
  };
}
