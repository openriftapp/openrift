import { createFileRoute } from "@tanstack/react-router";

import { myOrganizationsQueryOptions } from "@/features/tournaments/lib/organizations-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/playriftbound-sync")({
  ssr: "data-only",
  head: () => privateSeoHead("Sync a playriftbound event"),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...myOrganizationsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
});
