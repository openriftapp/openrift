import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import {
  ensureFriendGroupDetailCanonical,
  friendGroupMemberDetailQueryOptions,
} from "@/features/groups/lib/friend-groups-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute("/_app/_authenticated/groups/$slug_/members_/$userId")({
  ssr: "data-only",
  head: () => privateSeoHead("Group member"),
  loader: async ({ context, location, params }) => {
    await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
      alongside: notFoundOnSentinel(
        context.queryClient.query({
          ...friendGroupMemberDetailQueryOptions(context.userId, params.slug, params.userId),
          staleTime: "static",
        }),
      ),
    });
  },
  notFoundComponent: NotFoundFallback,
});
