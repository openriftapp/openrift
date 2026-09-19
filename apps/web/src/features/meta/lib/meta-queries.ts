import { metaContract } from "@openrift/shared/contracts/meta";
import type {
  MetaActivityResponse,
  MetaCountsQuery,
  MetaCountsResponse,
  MetaDeckCardIndexResponse,
  MetaDeckCardsQuery,
  MetaDeckFacetsQuery,
  MetaDeckFacetsResponse,
  MetaDeckQuery,
  MetaDeckDetailResponse,
  MetaDeckListResponse,
  MetaEventDayCountsQuery,
  MetaEventDayCountsResponse,
  MetaEventFacetsResponse,
  MetaEventFilterQuery,
  MetaEventListQuery,
  MetaEventRunResponse,
  MetaEventStandingsQuery,
  MetaEventStandingsResponse,
  MetaEventDetailResponse,
  MetaEventListResponse,
  MetaLegendDetailResponse,
  MetaLegendListResponse,
  MetaPendingSubmissionsResponse,
  MetaPlayerDetailResponse,
  MetaScopeQuery,
} from "@openrift/shared/types/api/meta";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { metaKeys, metaSubmissionsKeys } from "@/features/meta/lib/meta-query-keys";
import { serverCache } from "@/lib/server-cache";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type MetaLegendPageQuery = MetaScopeQuery & { page?: number };

function narrow<T extends object>(query?: T): T {
  return Object.fromEntries(
    Object.entries(query ?? {}).filter(([, value]) => value !== undefined),
  ) as T;
}

/** Defaults to {} because a bare GET to the endpoint arrives with no payload. */
export function optionalQuery<T extends object>(input?: T): T {
  return input ?? ({} as T);
}

function cacheKeyFor(query: Record<string, unknown>): unknown[] {
  return Object.entries(query)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .flat();
}

const fetchMetaEvents = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaEventListQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaEventListResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "events", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).events(query),
    }),
  );

/** One fixed page of the index, for a surface that shows a handful of events and no more. */
export function metaEventPageQueryOptions(query: MetaEventListQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.eventPage(narrowed),
    queryFn: () => fetchMetaEvents({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

/** What the decklist form needs up front: the linked event, or one row to tell an empty archive from a filled one. */
export function metaSubmitEventQuery(slug?: string): MetaEventListQuery {
  return slug === undefined ? { limit: 1 } : { slug, limit: 1 };
}

const EVENT_SEARCH_SIZE = 20;

/** The picker's own read: a handful of matches for what the reader has typed. */
export function metaEventSearchQuery(query: string): MetaEventListQuery {
  const needle = query.trim();
  return needle === "" ? { limit: EVENT_SEARCH_SIZE } : { q: needle, limit: EVENT_SEARCH_SIZE };
}

const fetchMetaEventFacets = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaEventFilterQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaEventFacetsResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "event-facets", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).eventFacets(query),
    }),
  );

export function metaEventFacetsQueryOptions(query: MetaEventFilterQuery = {}) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.eventFacets(narrowed),
    queryFn: () => fetchMetaEventFacets({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaEventDayCounts = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaEventDayCountsQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaEventDayCountsResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "event-day-counts", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).eventDayCounts(query),
    }),
  );

export function metaEventDayCountsQueryOptions(query?: MetaEventDayCountsQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.eventDayCounts(narrowed),
    queryFn: () => fetchMetaEventDayCounts({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaCounts = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaCountsQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaCountsResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "counts", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).counts(query),
    }),
  );

export function metaCountsQueryOptions(query?: MetaCountsQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.counts(narrowed),
    queryFn: () => fetchMetaCounts({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaActivity = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MetaActivityResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "activity"],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).activity(),
    }),
  );

export const metaActivityQueryOptions = queryOptions({
  queryKey: metaKeys.activity,
  queryFn: () => fetchMetaActivity(),
  staleTime: 5 * 60 * 1000,
});

const fetchMetaEvent = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: slug }): Promise<MetaEventDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(metaContract, context.cookie).event({ slug }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function metaEventQueryOptions(slug: string) {
  return queryOptions({
    queryKey: metaKeys.event(slug),
    queryFn: () => fetchMetaEvent({ data: slug }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) =>
      query.state.data?.event.status === "in_progress" ? LIVE_EVENT_REFETCH_MS : false,
  });
}

const LIVE_EVENT_REFETCH_MS = 5 * 60 * 1000;

const fetchMetaStandings = createServerFn({ method: "GET" })
  .validator((input: MetaEventStandingsQuery) => input)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaEventStandingsResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "standings", query.slug, ...cacheKeyFor(query)],
      queryFn: async () => {
        const { error, data } = await safe(
          apiOrpcClient(metaContract, context.cookie).standings(query),
        );
        if (error) {
          if (isDefinedError(error) && error.code === "NOT_FOUND") {
            throw notFoundError();
          }
          throw error;
        }
        return data;
      },
    }),
  );

/** One page of an event's standings under the page's own narrowing. */
export function metaStandingsQueryOptions(
  slug: string,
  query: Omit<MetaEventStandingsQuery, "slug"> = {},
) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.standings(slug, narrowed),
    queryFn: () => fetchMetaStandings({ data: { ...narrowed, slug } }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaRun = createServerFn({ method: "GET" })
  .validator((input: { slug: string; key: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<MetaEventRunResponse> => {
    const { error, data: run } = await safe(apiOrpcClient(metaContract, context.cookie).run(data));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return run;
  });

export function metaRunQueryOptions(slug: string, key: string) {
  return queryOptions({
    queryKey: metaKeys.run(slug, key),
    queryFn: () => fetchMetaRun({ data: { slug, key } }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaPendingSubmissions = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<MetaPendingSubmissionsResponse> =>
    apiOrpcClient(metaContract, context.cookie).pendingSubmissions({ slug }),
  );

/** `userId` only keys the cache: the endpoint reads the session to mark the viewer's own. */
export function metaPendingSubmissionsQueryOptions(slug: string, userId: string | null) {
  return queryOptions({
    queryKey: metaSubmissionsKeys.pendingForEvent(slug, userId),
    queryFn: () =>
      fetchMetaPendingSubmissions({ data: slug }) as Promise<MetaPendingSubmissionsResponse>,
  });
}

const fetchMetaDecks = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaDeckQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaDeckListResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "decks", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).decks(query),
    }),
  );

export function metaDecksQueryOptions(query?: MetaDeckQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.decks(narrowed),
    queryFn: () => fetchMetaDecks({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaDeckFacets = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaDeckFacetsQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaDeckFacetsResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "deck-facets", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).deckFacets(query),
    }),
  );

export function metaDeckFacetsQueryOptions(query?: MetaDeckFacetsQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.deckFacets(narrowed),
    queryFn: () => fetchMetaDeckFacets({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaDeckCards = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaDeckCardsQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaDeckCardIndexResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "deck-cards", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).deckCards(query),
    }),
  );

export function metaDeckCardsQueryOptions(query?: MetaDeckCardsQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.deckCards(narrowed),
    queryFn: () => fetchMetaDeckCards({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaDeck = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: token }): Promise<MetaDeckDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(metaContract, context.cookie).deck({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function metaDeckQueryOptions(token: string) {
  return queryOptions({
    queryKey: metaKeys.deck(token),
    queryFn: () => fetchMetaDeck({ data: token }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaLegends = createServerFn({ method: "GET" })
  .validator(optionalQuery<MetaScopeQuery>)
  .middleware([withCookies])
  .handler(({ context, data: query }): Promise<MetaLegendListResponse> =>
    serverCache.query({
      queryKey: ["server-cache", "meta", "legends", ...cacheKeyFor(query)],
      queryFn: () => apiOrpcClient(metaContract, context.cookie).legends(query),
    }),
  );

export function metaLegendsQueryOptions(query: MetaScopeQuery = {}) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.legends(narrowed),
    queryFn: () => fetchMetaLegends({ data: narrowed }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaLegend = createServerFn({ method: "GET" })
  .validator((input: MetaLegendPageQuery & { slug: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: query }): Promise<MetaLegendDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(metaContract, context.cookie).legend(query));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function metaLegendQueryOptions(slug: string, query?: MetaLegendPageQuery) {
  const narrowed = narrow(query);
  return queryOptions({
    queryKey: metaKeys.legend(slug, narrowed),
    queryFn: () => fetchMetaLegend({ data: { ...narrowed, slug } }),
    staleTime: 5 * 60 * 1000,
  });
}

const fetchMetaPlayer = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: key }): Promise<MetaPlayerDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(metaContract, context.cookie).player({ key }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function metaPlayerQueryOptions(key: string) {
  return queryOptions({
    queryKey: metaKeys.player(key),
    queryFn: () => fetchMetaPlayer({ data: key }),
    staleTime: 5 * 60 * 1000,
  });
}
