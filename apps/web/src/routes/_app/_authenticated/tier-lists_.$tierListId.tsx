import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { tierListQueryOptions } from "@/features/stage/lib/tier-lists-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/_authenticated/tier-lists_/$tierListId")({
  ssr: "data-only",
  // The builder hosts a full card browser (the pool), so it carries the shared
  // filter search params like /cards and the deck editor do.
  validateSearch: filterSearchSchema,
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Tier list", noIndex: true }),
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({
        to: "/tier-lists/$tierListId",
        params: { tierListId: params.tierListId },
        search: cleaned,
        replace: true,
      });
    }
  },
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.query({
        ...tierListQueryOptions(context.userId, params.tierListId),
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.tier_lists_not_found_title()}
      description={m.tier_lists_not_found_description()}
      action={
        <Link to="/tier-lists" className={buttonVariants()}>
          {m.tier_lists_not_found_action()}
        </Link>
      }
    />
  ),
});
