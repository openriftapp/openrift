import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { userTradesQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/trades/buy")({
  ssr: "data-only",
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Buy missing cards", noIndex: true }),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...userTradesQueryOptions(context.userId),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
