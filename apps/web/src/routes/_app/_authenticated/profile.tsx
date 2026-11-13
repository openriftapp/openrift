import { createFileRoute } from "@tanstack/react-router";

import { preferencesQueryOptions } from "@/features/account/lib/preferences-queries";
import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/profile")({
  head: () => privateSeoHead("Profile"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({
        ...adminAccessQueryOptions(context.userId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...preferencesQueryOptions(context.userId),
        staleTime: "static",
      }),
    ]);
  },
});
