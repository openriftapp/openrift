import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-query";
import { metaEventPageQueryOptions, metaSubmitEventQuery } from "@/features/meta/lib/meta-queries";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

/**
 * Entry point for a decklist without a slug; `/meta/$slug/submit` requires
 * one that a submission-only proposal doesn't have.
 */
export const Route = createFileRoute("/_app/_authenticated/meta_/submit")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Send a decklist", noIndex: true }),
  loader: async ({ context }) => {
    const flags = (await context.queryClient.query({
      ...featureFlagsQueryOptions,
      staleTime: "static",
    })) as FeatureFlags;
    if (!featureEnabled(flags, "meta")) {
      throw redirect({ to: "/cards" });
    }
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...metaEventPageQueryOptions(metaSubmitEventQuery()),
        staleTime: "static",
      }),
      // The catalog turns a pasted deck code's short codes into the card names
      // the submission endpoint takes.
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
