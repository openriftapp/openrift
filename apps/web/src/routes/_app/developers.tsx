import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/developers")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Riftbound API",
      description:
        "Free Riftbound API with card data as JSON: catalog, cards, sets, prices and rules. No API key needed.",
      path: "/developers",
    }),
  errorComponent: RouteErrorFallback,
});
