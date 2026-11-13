import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { ensureFriendGroupDetailCanonical } from "@/features/groups/lib/friend-groups-queries";
import { groupTournamentsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/groups/$slug_/events")({
  ssr: "data-only",
  head: () => privateSeoHead("Tournaments"),
  loader: async ({ context, location, params }) => {
    await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
      alongside: context.queryClient.query({
        ...groupTournamentsQueryOptions(context.userId, params.slug),
        staleTime: "static",
      }),
    });
  },
  errorComponent: RouteErrorFallback,
});
