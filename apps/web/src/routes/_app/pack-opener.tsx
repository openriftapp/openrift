import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/pack-opener")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Pack opener",
      description:
        "Open virtual Riftbound booster packs with the real published pull rates. Entertainment only.",
      path: "/pack-opener",
      noIndex: true,
    }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...publicSetListQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
