import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/features")({
  loader: async ({ context }) => {
    // The vignettes render without card art when the summary is missing.
    const { landingSummaryQueryOptions } =
      await import("@/features/marketing/lib/landing-summary-queries");
    await context.queryClient
      .query({ ...landingSummaryQueryOptions, staleTime: "static" })
      .catch(() => null);
  },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Features",
      description: `Everything OpenRift does: a card scanner, collection tracking, daily prices from ${ALL_MARKETPLACES.length} marketplaces, deck building with legality checks, private trade groups, loans, tournaments, and streaming tools.`,
      path: "/features",
    }),
});
