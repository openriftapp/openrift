import { createFileRoute, redirect } from "@tanstack/react-router";

import { ensureFriendGroupDetailCanonical } from "@/features/groups/lib/friend-groups-queries";

// Trade emails link here, so the slug is resolved through the group's rename aliases first.
export const Route = createFileRoute("/_app/_authenticated/groups/$slug_/trades")({
  loader: async ({ context, location, params }) => {
    const detail = await ensureFriendGroupDetailCanonical({
      queryClient: context.queryClient,
      userId: context.userId,
      slug: params.slug,
      location,
    });
    throw redirect({ to: "/trades", search: { group: detail.group.slug }, replace: true });
  },
});
