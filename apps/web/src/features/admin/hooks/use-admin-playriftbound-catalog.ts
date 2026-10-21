import type {
  MetaCatalogSort,
  MetaCatalogSortDirection,
  MetaCatalogTriage,
  MetaSyncTriggerResult,
  PlayriftboundCatalogListResponse,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { adminMetaCatalogContract } from "@openrift/shared/contracts/admin/meta-catalog";
import type {
  PlayriftboundFormat,
  PlayriftboundTournamentType,
} from "@openrift/shared/types/enums";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { metaKeys } from "@/features/meta/lib/meta-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export interface PlayriftboundCatalogParams {
  page?: number;
  search?: string;
  triage?: MetaCatalogTriage;
  tournamentType?: PlayriftboundTournamentType;
  format?: PlayriftboundFormat;
  minPlayers?: number;
  dateFrom?: string;
  dateTo?: string;
  missing?: boolean;
  awaitingResults?: boolean;
  sort?: MetaCatalogSort;
  direction?: MetaCatalogSortDirection;
}

export const PLAYRIFTBOUND_CATALOG_PAGE_SIZE = 50;

const fetchPlayriftboundCatalog = createServerFn({ method: "GET" })
  .validator((input: PlayriftboundCatalogParams) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<PlayriftboundCatalogListResponse> =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).playriftboundList({
      page: data.page,
      limit: PLAYRIFTBOUND_CATALOG_PAGE_SIZE,
      search: data.search,
      triage: data.triage,
      tournamentType: data.tournamentType,
      format: data.format,
      minPlayers: data.minPlayers,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      sort: data.sort,
      direction: data.direction,
      // Query strings coerce "false" to true; an off toggle must be absent, never false.
      missing: data.missing === true ? true : undefined,
      awaitingResults: data.awaitingResults === true ? true : undefined,
    }),
  );

export function useAdminPlayriftboundCatalog(params: PlayriftboundCatalogParams) {
  return useQuery(
    queryOptions({
      queryKey: adminKeys.meta.playriftboundCatalogueList(params),
      queryFn: () => fetchPlayriftboundCatalog({ data: params }),
      placeholderData: keepPreviousData,
    }),
  );
}

const acceptFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).playriftboundAccept(data),
  );

const acceptInvalidates = [
  adminKeys.meta.playriftboundCatalogue,
  adminKeys.meta.syncStatus.prefix,
  adminKeys.meta.events,
  adminKeys.meta.overlays,
  metaKeys.all,
] as const;

export function useAcceptPlayriftboundEvent() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string }) => acceptFn({ data: vars }),
    invalidates: acceptInvalidates,
  });
}

const dismissFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaCatalogContract, context.cookie).playriftboundDismiss(data);
  });

export function useDismissPlayriftboundEvent() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string }) => dismissFn({ data: vars }),
    invalidates: [adminKeys.meta.playriftboundCatalogue, adminKeys.meta.syncStatus.prefix],
  });
}

const undismissFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminMetaCatalogContract, context.cookie).playriftboundUndismiss(data);
  });

export function useUndismissPlayriftboundEvent() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { tournamentId: string }) => undismissFn({ data: vars }),
    invalidates: [adminKeys.meta.playriftboundCatalogue, adminKeys.meta.ignoredSources],
  });
}

const fetchEventFn = createServerFn({ method: "POST" })
  .validator((input: { tournamentId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).playriftboundFetchEvent(data),
  );

export function useFetchPlayriftboundEvent() {
  return useMutationWithInvalidation<MetaSyncTriggerResult, { tournamentId: string }>({
    mutationFn: (vars) => fetchEventFn({ data: vars }),
    invalidates: acceptInvalidates,
  });
}
