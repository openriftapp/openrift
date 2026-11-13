import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { ensureFriendGroupDetailCanonical } from "@/features/groups/lib/friend-groups-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/groups/$slug")({
  ssr: "data-only",
  head: () => privateSeoHead("Group"),
  loader: async ({ context, location, params }) => {
    await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
    });
  },
  errorComponent: RouteErrorFallback,
});
