import { createFileRoute } from "@tanstack/react-router";

import { tournamentsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/tournaments_/")({
  ssr: "data-only",
  head: () => privateSeoHead("Tournaments"),
  loader: async ({ context }) => {
    await context.queryClient.infiniteQuery({
      ...tournamentsQueryOptions(context.userId),
      staleTime: "static",
    });
  },
});
