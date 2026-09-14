import type { MetaCountsQuery, MetaEventDayCountsQuery } from "@openrift/shared/types/api/meta";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import type { MetaLegendPageQuery } from "@/features/meta/lib/meta-queries";
import {
  metaActivityQueryOptions,
  metaCountsQueryOptions,
  metaEventDayCountsQueryOptions,
  metaDeckCardsQueryOptions,
  metaDeckQueryOptions,
  metaDecksQueryOptions,
  metaEventQueryOptions,
  metaEventsQueryOptions,
  metaLegendQueryOptions,
  metaLegendsQueryOptions,
  metaPlayerQueryOptions,
} from "@/features/meta/lib/meta-queries";
import type { MetaDateRange, MetaDeckQuery } from "@/features/meta/lib/meta-scope";

export function useMetaEvents(range?: MetaDateRange) {
  return useSuspenseQuery(metaEventsQueryOptions(range));
}

/** Not suspenseful: the era chip's counts fill in after the page, and a facet change keeps the last ones until the next arrive. */
export function useMetaEventDayCounts(query?: MetaEventDayCountsQuery) {
  return useQuery({ ...metaEventDayCountsQueryOptions(query), placeholderData: keepPreviousData });
}

export function useMetaCounts(query?: MetaCountsQuery) {
  return useSuspenseQuery(metaCountsQueryOptions(query));
}

export function useMetaActivity() {
  return useSuspenseQuery(metaActivityQueryOptions);
}

export function useMetaEvent(slug: string) {
  return useSuspenseQuery(metaEventQueryOptions(slug));
}

export function useMetaDecks(query?: MetaDeckQuery) {
  return useSuspenseQuery(metaDecksQueryOptions(query));
}

export function useMetaDeckCards(range?: MetaDateRange) {
  return useSuspenseQuery(metaDeckCardsQueryOptions(range));
}

export function useMetaDeck(token: string) {
  return useSuspenseQuery(metaDeckQueryOptions(token));
}

export function useMetaLegends() {
  return useSuspenseQuery(metaLegendsQueryOptions);
}

export function useMetaLegend(slug: string, query?: MetaLegendPageQuery) {
  return useSuspenseQuery(metaLegendQueryOptions(slug, query));
}

export function useMetaPlayer(key: string) {
  return useSuspenseQuery(metaPlayerQueryOptions(key));
}
