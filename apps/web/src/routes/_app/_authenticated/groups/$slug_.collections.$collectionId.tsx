import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute(
  "/_app/_authenticated/groups/$slug_/collections/$collectionId",
)({
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({
        to: "/groups/$slug/collections/$collectionId",
        params,
        search: cleaned,
        replace: true,
      });
    }
  },
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Shared collection", noIndex: true }),
  errorComponent: RouteErrorFallback,
});
