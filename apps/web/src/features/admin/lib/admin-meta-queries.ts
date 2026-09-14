import { adminMetaContract } from "@openrift/shared/contracts/admin/meta";
import type {
  AdminMetaEvent,
  AdminMetaEventList,
  AdminMetaPlayer,
} from "@openrift/shared/types/api/meta";
import type {
  META_EVENT_SORT_DIRECTIONS,
  META_EVENT_SORTS,
  MetaEventSourceFilter,
} from "@openrift/shared/types/enums";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type AdminMetaEventSort = (typeof META_EVENT_SORTS)[number];

export type AdminMetaEventSortDirection = (typeof META_EVENT_SORT_DIRECTIONS)[number];

export const ADMIN_META_EVENT_PAGE_SIZE = 50;

export interface AdminMetaEventQueryParams {
  page: number;
  search?: string;
  format?: string;
  source?: MetaEventSourceFilter;
  dateFrom?: string;
  dateTo?: string;
  incompleteStandings?: boolean;
  noDecks?: boolean;
  sort?: AdminMetaEventSort;
  direction?: AdminMetaEventSortDirection;
}

export const META_EVENT_SORT_FALLBACK = {
  sort: "eventDate",
  direction: "desc",
} as const satisfies { sort: AdminMetaEventSort; direction: AdminMetaEventSortDirection };

/**
 * Must build the identical key the route loader builds, or a warmed page
 * misses the cache and suspends on first paint.
 */
export function metaEventsParamsFromSearch(search: {
  page?: number;
  q?: string;
  liveFormat?: string;
  liveSource?: MetaEventSourceFilter;
  dateFrom?: string;
  dateTo?: string;
  incompleteStandings?: boolean;
  noDecks?: boolean;
  liveSort?: AdminMetaEventSort;
  liveDir?: AdminMetaEventSortDirection;
}): AdminMetaEventQueryParams {
  return {
    page: search.page ?? 1,
    search: search.q,
    format: search.liveFormat,
    source: search.liveSource,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    incompleteStandings: search.incompleteStandings,
    noDecks: search.noDecks,
    sort: search.liveSort ?? META_EVENT_SORT_FALLBACK.sort,
    direction: search.liveDir ?? META_EVENT_SORT_FALLBACK.direction,
  };
}

const fetchMetaEvents = createServerFn({ method: "GET" })
  .validator((input: AdminMetaEventQueryParams) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<AdminMetaEventList> =>
    apiOrpcClient(adminMetaContract, context.cookie).listEvents({
      page: data.page,
      limit: ADMIN_META_EVENT_PAGE_SIZE,
      search: data.search,
      format: data.format,
      source: data.source,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      sort: data.sort,
      direction: data.direction,
      // Query strings coerce "false" to true; an off toggle must be absent, never false.
      incompleteStandings: data.incompleteStandings === true ? true : undefined,
      noDecks: data.noDecks === true ? true : undefined,
    }),
  );

export function adminMetaEventsQueryOptions(params: AdminMetaEventQueryParams) {
  return queryOptions({
    queryKey: adminKeys.meta.eventList(params),
    queryFn: () => fetchMetaEvents({ data: params }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaEvent = createServerFn({ method: "GET" })
  .validator((eventId: string) => eventId)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<AdminMetaEvent> =>
    apiOrpcClient(adminMetaContract, context.cookie).getEvent({ id: data }),
  );

export function adminMetaEventQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: adminKeys.meta.event(eventId),
    queryFn: () => fetchMetaEvent({ data: eventId }),
  });
}

const fetchMetaEventPlayers = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ players: AdminMetaPlayer[] }> =>
    apiOrpcClient(adminMetaContract, context.cookie).eventPlayers({ id: data.id }),
  );

export function adminMetaEventPlayersQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: adminKeys.meta.eventPlayers(eventId),
    queryFn: () => fetchMetaEventPlayers({ data: { id: eventId } }),
    staleTime: 5 * 60 * 1000,
  });
}
