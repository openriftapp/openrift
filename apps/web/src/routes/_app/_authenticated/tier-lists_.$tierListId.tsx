import { createFileRoute, redirect } from "@tanstack/react-router";

import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { TierListGoneState } from "@/features/stage/components/tier-list-gone-state";
import { tierListQueryOptions } from "@/features/stage/lib/tier-lists-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute("/_app/_authenticated/tier-lists_/$tierListId")({
  ssr: "data-only",
  // The builder hosts a full card browser (the pool), so it carries the shared
  // filter search params like /cards and the deck editor do.
  validateSearch: filterSearchSchema,
  head: () => privateSeoHead("Tier list"),
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
    await notFoundOnSentinel(
      context.queryClient.query({
        ...tierListQueryOptions(context.userId, params.tierListId),
        staleTime: "static",
      }),
    );
  },
  notFoundComponent: TierListGoneState,
});
