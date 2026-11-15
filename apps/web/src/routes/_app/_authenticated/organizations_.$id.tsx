import { createFileRoute } from "@tanstack/react-router";

import { organizationQueryOptions } from "@/features/tournaments/lib/organizations-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/organizations_/$id")({
  ssr: "data-only",
  head: () => privateSeoHead("Organization"),
  loader: async ({ context, params }) => {
    await context.queryClient.query({
      ...organizationQueryOptions(context.userId, params.id),
      staleTime: "static",
    });
  },
});
