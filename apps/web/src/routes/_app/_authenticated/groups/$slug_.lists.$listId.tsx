import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/mini";

import { NotFoundFallback } from "@/components/error-message";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import {
  ensureFriendGroupDetailCanonical,
  friendGroupSharedListQueryOptions,
} from "@/features/groups/lib/friend-groups-queries";
import { lenient } from "@/lib/lenient-param";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

const sharedListSearchSchema = z.extend(filterSearchSchema, {
  fromUser: lenient(z.string()),
});

export const Route = createFileRoute("/_app/_authenticated/groups/$slug_/lists/$listId")({
  ssr: "data-only",
  validateSearch: sharedListSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(sharedListSearchSchema, search, location.searchStr, {
      legacySearchToQ: true,
    });
    if (cleaned) {
      throw redirect({ to: "/groups/$slug/lists/$listId", params, search: cleaned, replace: true });
    }
  },
  head: () => privateSeoHead("Shared list"),
  loader: async ({ context, location, params }) => {
    await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
      alongside: notFoundOnSentinel(
        context.queryClient.query({
          ...friendGroupSharedListQueryOptions(context.userId, params.slug, params.listId),
          staleTime: "static",
        }),
      ),
    });
  },
  notFoundComponent: NotFoundFallback,
});
