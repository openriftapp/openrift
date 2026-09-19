import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { META_EVENTS_DESCRIPTION } from "@/features/meta/components/meta-copy";
import {
  eventPageOrder,
  eventPageSlice,
  metaEventsSearchSchema,
} from "@/features/meta/lib/meta-events-search";
import {
  metaCountsQueryOptions,
  metaEventFacetsQueryOptions,
  metaEventPageQueryOptions,
} from "@/features/meta/lib/meta-queries";
import { deriveSetEras, metaEventFilterQuery } from "@/features/meta/lib/meta-scope";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/meta_/events")({
  validateSearch: metaEventsSearchSchema,
  // The whole narrowing: the API pages and sorts the index, so every control
  // that changes the first page is part of the loader's key.
  loaderDeps: ({ search }) => ({
    era: search.era,
    from: search.from,
    to: search.to,
    formats: search.formats,
    formatsEx: search.formatsEx,
    tiers: search.tiers,
    tiersEx: search.tiersEx,
    countries: search.countries,
    countriesEx: search.countriesEx,
    q: search.q,
    holds: search.holds,
    playersMin: search.playersMin,
    playersMax: search.playersMax,
    by: search.by,
    dir: search.dir,
    page: search.page,
    per: search.per,
  }),
  head: () => {
    const siteUrl = getSiteUrl();
    return {
      ...seoHead({
        siteUrl,
        title: "Archived Riftbound Events",
        description: META_EVENTS_DESCRIPTION,
        path: "/meta/events",
      }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: "Events", path: "/meta/events" },
        ]),
      ],
    };
  },
  beforeLoad: async ({ context }) => {
    const flags = (await context.queryClient.query({
      ...featureFlagsQueryOptions,
      staleTime: "static",
    })) as FeatureFlags;
    if (!featureEnabled(flags, "meta")) {
      throw redirect({ to: "/cards" });
    }
  },
  loader: async ({ context, deps }) => {
    const sets = await context.queryClient.query({
      ...publicSetListQueryOptions,
      staleTime: "static",
    });
    const filters = metaEventFilterQuery(deps, deriveSetEras(sets.sets));
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...metaEventPageQueryOptions({
          ...filters,
          ...eventPageOrder(deps),
          ...eventPageSlice(deps),
        }),
        staleTime: "static",
      }),
      context.queryClient.query({ ...metaEventFacetsQueryOptions(filters), staleTime: "static" }),
      context.queryClient.query({ ...metaCountsQueryOptions(), staleTime: "static" }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
