import { createFileRoute } from "@tanstack/react-router";

import { friendGroupShopEventsQueryOptions } from "@/features/groups/lib/friend-group-shops-queries";
import { ensureFriendGroupDetailCanonical } from "@/features/groups/lib/friend-groups-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/groups/$slug_/shops")({
  ssr: "data-only",
  head: () => privateSeoHead("Shop events"),
  loader: async ({ context, location, params }) => {
    await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
      alongside: context.queryClient.query({
        ...friendGroupShopEventsQueryOptions(context.userId, params.slug),
        staleTime: "static",
      }),
    });
  },
});
