import { DEVELOPERS_SHOWCASE } from "@openrift/shared/developers-showcase";
import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { seoHead } from "@/lib/seo";
import { developersShareImageUrl } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/developers")({
  loader: async ({ context }) => {
    // The hero renders without its card when the showcase card is missing.
    await context.queryClient
      .query({ ...cardDetailQueryOptions(DEVELOPERS_SHOWCASE.cardSlug), staleTime: "static" })
      .catch(() => null);
  },
  head: () => {
    const siteUrl = getSiteUrl();
    return seoHead({
      siteUrl,
      title: "Riftbound API",
      description:
        "Free Riftbound API with card data as JSON: catalog, cards, sets, prices and rules. No API key needed.",
      path: "/developers",
      ogImage: developersShareImageUrl(siteUrl),
    });
  },
  errorComponent: RouteErrorFallback,
});
