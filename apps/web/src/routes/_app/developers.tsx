import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { SHOWCASE_CARD_SLUG } from "@/features/marketing/lib/developer-endpoints";
import { seoHead } from "@/lib/seo";
import { developersShareImageUrl } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/developers")({
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
  loader: async ({ context }) => {
    // The hero renders without its card when the showcase card is missing.
    await context.queryClient
      .query({ ...cardDetailQueryOptions(SHOWCASE_CARD_SLUG), staleTime: "static" })
      .catch(() => null);
  },
  errorComponent: RouteErrorFallback,
});
