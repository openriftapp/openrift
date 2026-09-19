import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { META_DESCRIPTION } from "@/features/meta/components/meta-copy";
import { metaOverviewSearchSchema } from "@/features/meta/lib/meta-deck-search";
import {
  META_FRONT_SECTION_LIMITS,
  metaFrontSectionQuery,
  metaFrontUpcomingQuery,
} from "@/features/meta/lib/meta-front-page";
import {
  metaActivityQueryOptions,
  metaCountsQueryOptions,
  metaEventFacetsQueryOptions,
  metaEventPageQueryOptions,
} from "@/features/meta/lib/meta-queries";
import { deriveSetEras, metaEventFilterQuery } from "@/features/meta/lib/meta-scope";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/meta")({
  validateSearch: metaOverviewSearchSchema,
  // The whole narrowing: every section is its own server-side read.
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
    decks: search.decks,
  }),
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Riftbound Meta Archive",
      description: META_DESCRIPTION,
      path: "/meta",
    }),
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
    const filters = metaEventFilterQuery(
      { ...deps, holds: deps.decks === true ? "decks" : undefined },
      deriveSetEras(sets.sets),
    );
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...metaEventFacetsQueryOptions(filters), staleTime: "static" }),
      ...Object.keys(META_FRONT_SECTION_LIMITS)
        .filter((tier) => tier !== "upcoming")
        .map((tier) =>
          context.queryClient.query({
            ...metaEventPageQueryOptions(
              metaFrontSectionQuery(filters, tier as "premier" | "competitive" | "local"),
            ),
            staleTime: "static",
          }),
        ),
      context.queryClient.query({
        ...metaEventPageQueryOptions(metaFrontUpcomingQuery(filters)),
        staleTime: "static",
      }),
      context.queryClient.query({ ...metaCountsQueryOptions(), staleTime: "static" }),
      context.queryClient.query({ ...metaActivityQueryOptions, staleTime: "static" }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
