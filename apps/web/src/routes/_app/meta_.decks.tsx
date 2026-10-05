import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { META_DECKS_DESCRIPTION } from "@/features/meta/lib/meta-copy";
import { metaDeckSearchSchema } from "@/features/meta/lib/meta-deck-search";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/meta_/decks")({
  validateSearch: metaDeckSearchSchema,
  head: () => {
    const siteUrl = getSiteUrl();
    return {
      ...seoHead({
        siteUrl,
        title: "Archived Riftbound Decks",
        description: META_DECKS_DESCRIPTION,
        path: "/meta/decks",
      }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: "Archived decks", path: "/meta/decks" },
        ]),
      ],
    };
  },
  loader: async ({ context }) => {
    await context.queryClient.query({ ...initQueryOptions, staleTime: "static" });
  },
  errorComponent: RouteErrorFallback,
});
