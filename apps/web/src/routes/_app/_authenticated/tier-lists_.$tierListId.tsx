import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { Link2OffIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { RouteErrorFallback } from "@/components/error-message";
import { buttonVariants } from "@/components/ui/button";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { tierListQueryOptions } from "@/features/stage/hooks/use-tier-lists";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";
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
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: TierListNotFound,
});

function TierListNotFound() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full)}>
      <EmptyState
        className="py-16"
        icon={Link2OffIcon}
        title={m.tier_lists_not_found_title()}
        description={m.tier_lists_not_found_description()}
      >
        <Link to="/tier-lists" className={buttonVariants()}>
          {m.tier_lists_not_found_action()}
        </Link>
      </EmptyState>
    </div>
  );
}
