import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import type {
  CatalogCardListResponse,
  CatalogSourcesResponse,
} from "@openrift/shared/contracts/admin/catalog-review";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchCatalogCards = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CatalogCardListResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).catalogCards(),
  );

export const catalogCardsQueryOptions = queryOptions({
  queryKey: catalogAdminKeys.cards,
  queryFn: () => fetchCatalogCards(),
  staleTime: 60 * 1000,
});

export function useCatalogCards() {
  return useQuery(catalogCardsQueryOptions);
}

export function useCatalogCardsWhen(enabled: boolean) {
  return useQuery({ ...catalogCardsQueryOptions, enabled });
}

const fetchCatalogSources = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CatalogSourcesResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).catalogSources(),
  );

export const catalogSourcesQueryOptions = queryOptions({
  queryKey: catalogAdminKeys.sources,
  queryFn: () => fetchCatalogSources(),
  staleTime: 60 * 1000,
});

export function useCatalogSources() {
  return useQuery(catalogSourcesQueryOptions);
}
