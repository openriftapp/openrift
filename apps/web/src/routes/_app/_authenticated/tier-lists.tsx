import { createFileRoute } from "@tanstack/react-router";

import { tierListsQueryOptions } from "@/features/stage/lib/tier-lists-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tier-lists")({
  ssr: "data-only",
  head: () => privateSeoHead("Tier lists"),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...tierListsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
});
