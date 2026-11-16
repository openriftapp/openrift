import { createFileRoute, redirect } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import {
  ensureFriendGroupDetailCanonical,
  friendGroupSharedCollectionQueryOptions,
} from "@/features/groups/lib/friend-groups-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute(
  "/_app/_authenticated/groups/$slug_/collections/$collectionId",
)({
  ssr: "data-only",
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr, {
      legacySearchToQ: true,
    });
    if (cleaned) {
      throw redirect({
        to: "/groups/$slug/collections/$collectionId",
        params,
        search: cleaned,
        replace: true,
      });
    }
  },
  head: () => privateSeoHead("Shared collection"),
  loader: async ({ context, location, params }) => {
    await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
      alongside: notFoundOnSentinel(
        context.queryClient.query({
          ...friendGroupSharedCollectionQueryOptions(
            context.userId,
            params.slug,
            params.collectionId,
          ),
          staleTime: "static",
        }),
      ),
    });
  },
  notFoundComponent: NotFoundFallback,
});
