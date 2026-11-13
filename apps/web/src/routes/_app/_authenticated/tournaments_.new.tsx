import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { friendGroupsQueryOptions } from "@/features/groups/lib/friend-groups-queries";
import { myOrganizationsQueryOptions } from "@/features/tournaments/lib/organizations-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/new")({
  ssr: "data-only",
  head: () => privateSeoHead("New tournament"),
  validateSearch: (search: Record<string, unknown>): { group?: string } => ({
    group: typeof search.group === "string" ? search.group : undefined,
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({
        ...myOrganizationsQueryOptions(context.userId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...friendGroupsQueryOptions(context.userId),
        staleTime: "static",
      }),
    ]);
  },
  errorComponent: RouteErrorFallback,
});
