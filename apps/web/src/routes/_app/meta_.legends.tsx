import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { META_LEGENDS_DESCRIPTION } from "@/features/meta/components/meta-copy";
import { metaLegendsSearchSchema } from "@/features/meta/lib/meta-legends-search";
import { metaLegendsQueryOptions } from "@/features/meta/lib/meta-queries";
import { deriveSetEras, metaScopeQueryFromScope } from "@/features/meta/lib/meta-scope";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/meta_/legends")({
  validateSearch: metaLegendsSearchSchema,
  // The whole scope: the API folds each legend's record under it. The search
  // box stays out, narrowing the entries in the browser.
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
  }),
  head: () => {
    const siteUrl = getSiteUrl();
    return {
      ...seoHead({
        siteUrl,
        title: "Riftbound Legends in the Meta Archive",
        description: META_LEGENDS_DESCRIPTION,
        path: "/meta/legends",
      }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: "Legends", path: "/meta/legends" },
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
    const scope = metaScopeQueryFromScope(deps, deriveSetEras(sets.sets));
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...metaLegendsQueryOptions(scope), staleTime: "static" }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
