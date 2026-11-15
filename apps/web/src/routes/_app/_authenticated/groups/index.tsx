import { createFileRoute } from "@tanstack/react-router";

import { friendGroupsQueryOptions } from "@/features/groups/lib/friend-groups-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/groups/")({
  ssr: "data-only",
  head: () => privateSeoHead("Groups"),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...friendGroupsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
});
