import { priceLookupFromMap } from "@openrift/shared/price-lookup";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { QueryClient } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";

export function usePrices(): PriceLookup {
  const { data } = useSuspenseQuery(pricesQueryOptions);
  return data;
}

// Resolves a PriceLookup outside of React render (e.g. building share text on a click).
export async function ensurePriceLookup(queryClient: QueryClient): Promise<PriceLookup> {
  const response = await queryClient.query({
    queryKey: pricesQueryOptions.queryKey,
    queryFn: pricesQueryOptions.queryFn,
    staleTime: "static",
  });
  return priceLookupFromMap(response.prices);
}
