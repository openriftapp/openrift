import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/mini";

import { RouteErrorFallback } from "@/components/error-message";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { lenient } from "@/lib/lenient-param";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

const sharedListSearchSchema = z.extend(filterSearchSchema, {
  fromUser: lenient(z.string()),
});

export const Route = createFileRoute("/_app/_authenticated/groups/$slug_/lists/$listId")({
  validateSearch: sharedListSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(sharedListSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({ to: "/groups/$slug/lists/$listId", params, search: cleaned, replace: true });
    }
  },
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Shared list", noIndex: true }),
  errorComponent: RouteErrorFallback,
});
