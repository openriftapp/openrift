import type {
  MetaCatalogListResponse,
  MetaCatalogSort,
  MetaCatalogSortDirection,
  MetaCatalogTriage,
  MetaSource,
  MetaSyncBucketFilter,
  MetaSyncTriggerResult,
  PlayloltcgCatalogListResponse,
  PlayriftboundCatalogListResponse,
  TopdeckCatalogListResponse,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { adminMetaCatalogContract } from "@openrift/shared/contracts/admin/meta-catalog";
import type {
  META_CATALOG_DISPLAY_STATUSES,
  PlayloltcgStatus,
  PlayriftboundFormat,
  PlayriftboundTournamentType,
} from "@openrift/shared/types/enums";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { catalogDayBoundary } from "@/features/meta/lib/meta-catalog-display";
import { metaKeys } from "@/features/meta/lib/meta-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export const META_MIRROR_PAGE_SIZE = 50;

interface MetaMirrorParams {
  source: MetaSource;
  page: number;
  search?: string;
  triage?: MetaCatalogTriage;
  bucket?: MetaSyncBucketFilter;
  minPlayers?: number;
  /** `YYYY-MM-DD`, inclusive, read as UTC days. */
  dateFrom?: string;
  dateTo?: string;
  missing?: boolean;
  sort?: MetaCatalogSort;
  direction?: MetaCatalogSortDirection;
  displayStatus?: (typeof META_CATALOG_DISPLAY_STATUSES)[number];
  decklistPublished?: boolean;
  plStatus?: PlayloltcgStatus;
  tdFormat?: string;
  prType?: PlayriftboundTournamentType;
  prFormat?: PlayriftboundFormat;
}

export type MetaMirrorResponse =
  | { source: "uvsgames"; data: MetaCatalogListResponse }
  | { source: "playloltcg"; data: PlayloltcgCatalogListResponse }
  | { source: "topdeck"; data: TopdeckCatalogListResponse }
  | { source: "playriftbound"; data: PlayriftboundCatalogListResponse };

const fetchMetaMirror = createServerFn({ method: "GET" })
  .validator((input: MetaMirrorParams) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<MetaMirrorResponse> => {
    const client = apiOrpcClient(adminMetaCatalogContract, context.cookie);
    // Query strings coerce "false" to true; an off toggle must be absent, never false.
    const shared = {
      page: data.page,
      limit: META_MIRROR_PAGE_SIZE,
      search: data.search,
      triage: data.triage,
      bucket: data.bucket,
      minPlayers: data.minPlayers,
      missing: data.missing === true ? true : undefined,
      sort: data.sort,
      direction: data.direction,
    };
    switch (data.source) {
      case "uvsgames": {
        return {
          source: "uvsgames",
          data: await client.list({
            ...shared,
            displayStatus: data.displayStatus,
            decklistPublished: data.decklistPublished === true ? true : undefined,
            dateFrom:
              data.dateFrom === undefined ? undefined : catalogDayBoundary(data.dateFrom, "start"),
            dateTo: data.dateTo === undefined ? undefined : catalogDayBoundary(data.dateTo, "end"),
          }),
        };
      }
      case "playloltcg": {
        return {
          source: "playloltcg",
          data: await client.playloltcgList({
            ...shared,
            status: data.plStatus,
            dateFrom: data.dateFrom,
            dateTo: data.dateTo,
          }),
        };
      }
      case "topdeck": {
        return {
          source: "topdeck",
          data: await client.topdeckList({
            ...shared,
            format: data.tdFormat,
            dateFrom: data.dateFrom,
            dateTo: data.dateTo,
          }),
        };
      }
      case "playriftbound": {
        return {
          source: "playriftbound",
          data: await client.playriftboundList({
            ...shared,
            tournamentType: data.prType,
            format: data.prFormat,
            dateFrom: data.dateFrom,
            dateTo: data.dateTo,
          }),
        };
      }
    }
  });

export function useMetaMirror(params: MetaMirrorParams) {
  return useQuery({
    queryKey: adminKeys.meta.mirrorList(params),
    queryFn: () => fetchMetaMirror({ data: params }),
    placeholderData: keepPreviousData,
  });
}

const writeInvalidates = [
  adminKeys.meta.mirror,
  adminKeys.meta.syncStatus.prefix,
  adminKeys.meta.events,
  adminKeys.meta.overlays,
  adminKeys.meta.ignoredSources,
  metaKeys.all,
] as const;

interface RowTarget {
  source: MetaSource;
  key: string;
}

const publishRowFn = createServerFn({ method: "POST" })
  .validator((input: RowTarget & { format?: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<{ slug: string }> => {
    const client = apiOrpcClient(adminMetaCatalogContract, context.cookie);
    switch (data.source) {
      case "uvsgames": {
        return await client.accept({ externalId: data.key, format: data.format });
      }
      case "playloltcg": {
        return await client.playloltcgAccept({ activityShopId: Number(data.key) });
      }
      case "topdeck": {
        return await client.topdeckAccept({ tid: data.key });
      }
      case "playriftbound": {
        return await client.playriftboundAccept({ tournamentId: data.key });
      }
    }
  });

/** `format` is needed only where the source's own format maps to nothing of ours. */
export function usePublishMirrorRow() {
  return useMutationWithInvalidation({
    mutationFn: (vars: RowTarget & { format?: string }) => publishRowFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

const rejectRowFn = createServerFn({ method: "POST" })
  .validator((input: RowTarget) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const client = apiOrpcClient(adminMetaCatalogContract, context.cookie);
    switch (data.source) {
      case "uvsgames": {
        await client.dismiss({ externalId: data.key });
        return;
      }
      case "playloltcg": {
        await client.playloltcgDismiss({ activityShopId: Number(data.key) });
        return;
      }
      case "topdeck": {
        await client.topdeckDismiss({ tid: data.key });
        return;
      }
      case "playriftbound": {
        await client.playriftboundDismiss({ tournamentId: data.key });
      }
    }
  });

export function useRejectMirrorRow() {
  return useMutationWithInvalidation({
    mutationFn: (vars: RowTarget) => rejectRowFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

const restoreRowFn = createServerFn({ method: "POST" })
  .validator((input: RowTarget) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const client = apiOrpcClient(adminMetaCatalogContract, context.cookie);
    switch (data.source) {
      case "uvsgames": {
        await client.undismiss({ externalId: data.key });
        return;
      }
      case "playloltcg": {
        await client.playloltcgUndismiss({ activityShopId: Number(data.key) });
        return;
      }
      case "topdeck": {
        await client.topdeckUndismiss({ tid: data.key });
        return;
      }
      case "playriftbound": {
        await client.playriftboundUndismiss({ tournamentId: data.key });
      }
    }
  });

export function useRestoreMirrorRow() {
  return useMutationWithInvalidation({
    mutationFn: (vars: RowTarget) => restoreRowFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

const collectRowFn = createServerFn({ method: "POST" })
  .validator((input: RowTarget) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<MetaSyncTriggerResult> => {
    const client = apiOrpcClient(adminMetaCatalogContract, context.cookie);
    switch (data.source) {
      case "uvsgames": {
        return await client.fetchEvent({ externalId: data.key });
      }
      case "playloltcg": {
        return await client.playloltcgFetchEvent({ activityShopId: Number(data.key) });
      }
      case "playriftbound": {
        return await client.playriftboundFetchEvent({ tournamentId: data.key });
      }
      case "topdeck": {
        throw new Error("This source has no Collect results job.");
      }
    }
  });

export function useCollectMirrorRow() {
  return useMutationWithInvalidation<MetaSyncTriggerResult, RowTarget>({
    mutationFn: (vars) => collectRowFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

interface BulkTarget {
  source: MetaSource;
  keys: string[];
}

const bulkPublishFn = createServerFn({ method: "POST" })
  .validator((input: BulkTarget) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).bulkPublish(data),
  );

const bulkRejectFn = createServerFn({ method: "POST" })
  .validator((input: BulkTarget) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).bulkReject(data),
  );

const bulkRestoreFn = createServerFn({ method: "POST" })
  .validator((input: BulkTarget) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).bulkRestore(data),
  );

const bulkUnpublishFn = createServerFn({ method: "POST" })
  .validator((input: BulkTarget) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminMetaCatalogContract, context.cookie).bulkUnpublish(data),
  );

export function useBulkPublishMirror() {
  return useMutationWithInvalidation({
    mutationFn: (vars: BulkTarget) => bulkPublishFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

export function useBulkRejectMirror() {
  return useMutationWithInvalidation({
    mutationFn: (vars: BulkTarget) => bulkRejectFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

export function useBulkRestoreMirror() {
  return useMutationWithInvalidation({
    mutationFn: (vars: BulkTarget) => bulkRestoreFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}

/** The undo of a bulk publish: an event that already has standings stays. */
export function useBulkUnpublishMirror() {
  return useMutationWithInvalidation({
    mutationFn: (vars: BulkTarget) => bulkUnpublishFn({ data: vars }),
    invalidates: writeInvalidates,
  });
}
