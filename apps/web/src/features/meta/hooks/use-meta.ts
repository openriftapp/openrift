import type {
  MetaCountsQuery,
  MetaDeckCardsQuery,
  MetaDeckFacetsQuery,
  MetaDeckQuery,
  MetaEventDayCountsQuery,
  MetaEventFilterQuery,
  MetaEventListQuery,
  MetaEventStandingsQuery,
  MetaScopeQuery,
} from "@openrift/shared/types/api/meta";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import type { MetaLegendPageQuery } from "@/features/meta/lib/meta-queries";
import {
  metaActivityQueryOptions,
  metaCountsQueryOptions,
  metaEventDayCountsQueryOptions,
  metaDeckCardsQueryOptions,
  metaDeckFacetsQueryOptions,
  metaDeckQueryOptions,
  metaDecksQueryOptions,
  metaEventFacetsQueryOptions,
  metaEventPageQueryOptions,
  metaEventSearchQuery,
  metaEventQueryOptions,
  metaLegendQueryOptions,
  metaLegendsQueryOptions,
  metaPendingSubmissionsQueryOptions,
  metaRunQueryOptions,
  metaStandingsQueryOptions,
  metaPlayerQueryOptions,
} from "@/features/meta/lib/meta-queries";
import { useUserId } from "@/lib/auth-session";

export function useMetaPendingSubmissions(slug: string) {
  return useQuery(metaPendingSubmissionsQueryOptions(slug, useUserId()));
}

export function useMetaEventPage(query: MetaEventListQuery) {
  return useSuspenseQuery(metaEventPageQueryOptions(query));
}

export function useMetaEventFacets(query?: MetaEventFilterQuery) {
  return useSuspenseQuery(metaEventFacetsQueryOptions(query));
}

/** Not suspenseful: the picker keeps the last matches on screen while the next ones load. */
export function useMetaEventSearch(query: string) {
  return useQuery({
    ...metaEventPageQueryOptions(metaEventSearchQuery(query)),
    placeholderData: keepPreviousData,
  });
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

/** Not suspenseful: the standings keep the last page on screen while the next narrowing loads. */
export function useMetaStandings(slug: string, query: Omit<MetaEventStandingsQuery, "slug">) {
  return useQuery({
    ...metaStandingsQueryOptions(slug, query),
    placeholderData: keepPreviousData,
  });
}

export function useMetaRun(slug: string, key: string) {
  return useSuspenseQuery(metaRunQueryOptions(slug, key));
}

export function useMetaDecks(query?: MetaDeckQuery) {
  return useSuspenseQuery(metaDecksQueryOptions(query));
}

export function useMetaDeckFacets(query?: MetaDeckFacetsQuery) {
  return useSuspenseQuery(metaDeckFacetsQueryOptions(query));
}

export function useMetaDeckCards(query?: MetaDeckCardsQuery) {
  return useSuspenseQuery(metaDeckCardsQueryOptions(query));
}

export function useMetaDeck(token: string) {
  return useSuspenseQuery(metaDeckQueryOptions(token));
}

export function useMetaLegends(query?: MetaScopeQuery) {
  return useSuspenseQuery(metaLegendsQueryOptions(query));
}

export function useMetaLegend(slug: string, query?: MetaLegendPageQuery) {
  return useSuspenseQuery(metaLegendQueryOptions(slug, query));
}

export function useMetaPlayer(key: string) {
  return useSuspenseQuery(metaPlayerQueryOptions(key));
}
