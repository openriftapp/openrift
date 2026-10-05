import { joinCatalogCards } from "@openrift/shared/catalog-join";
import type {
  ProductDetailResponse,
  ProductsListResponse,
} from "@openrift/shared/contracts/products";
import { productsContract } from "@openrift/shared/contracts/products";
import { todayUtc } from "@openrift/shared/format-date";
import { isReleasedIn } from "@openrift/shared/set-release";
import type { Printing } from "@openrift/shared/types/catalog";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { productsKeys } from "@/features/cards/lib/cards-query-keys";
import { serverCacheKeys } from "@/lib/query-keys";
import { serverCache } from "@/lib/server-cache";
import { orNotFound } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchProducts = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ProductsListResponse> =>
    serverCache.query({
      queryKey: serverCacheKeys.products,
      queryFn: () => apiOrpcClient(productsContract, context.cookie).list(),
    }),
  );

export const productsListQueryOptions = queryOptions({
  queryKey: productsKeys.all,
  queryFn: () => fetchProducts(),
  staleTime: 5 * 60 * 1000,
});

const fetchProductDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<ProductDetailResponse> =>
    orNotFound(apiOrpcClient(productsContract, context.cookie).get({ slug })),
  );

export interface EnrichedProductDetail {
  product: ProductDetailResponse["product"];
  contents: ProductDetailResponse["contents"];
  sets: ProductDetailResponse["sets"];
  printings: Printing[];
  printingsById: Record<string, Printing>;
}

// Joins against the inlined cards/sets, not the global catalog, so the
// product page can render server-side.
function enrichProductDetail(response: ProductDetailResponse): EnrichedProductDetail {
  const setById = new Map(response.sets.map((set) => [set.id, set]));
  const today = todayUtc();
  const cardsById = joinCatalogCards(response.cards, today);
  const printings: Printing[] = [];
  const printingsById: Record<string, Printing> = {};
  for (const wire of response.printings) {
    const set = setById.get(wire.setId);
    const card = cardsById[wire.cardId];
    if (!set || !card) {
      continue;
    }
    const printing: Printing = {
      ...wire,
      setSlug: set.slug,
      setReleased: isReleasedIn(set.releases, wire.language, today),
      card,
    };
    printings.push(printing);
    printingsById[printing.id] = printing;
  }
  return {
    product: response.product,
    contents: response.contents,
    sets: response.sets,
    printings,
    printingsById,
  };
}

export function productDetailQueryOptions(slug: string) {
  return queryOptions({
    queryKey: productsKeys.detail(slug),
    queryFn: () => fetchProductDetail({ data: slug }),
    staleTime: 5 * 60 * 1000,
    select: enrichProductDetail,
  });
}
