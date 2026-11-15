import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/features")({
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Features",
      description: `Everything OpenRift does: a card scanner, collection tracking, daily prices from ${ALL_MARKETPLACES.length} marketplaces, deck building with legality checks, private trade groups, loans, tournaments, and streaming tools.`,
      path: "/features",
    }),
});
