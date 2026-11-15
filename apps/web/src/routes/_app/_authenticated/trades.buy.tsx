import { createFileRoute } from "@tanstack/react-router";

import { userTradesQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/trades/buy")({
  ssr: "data-only",
  head: () => privateSeoHead("Buy missing cards"),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...userTradesQueryOptions(context.userId),
      staleTime: "static",
    });
  },
});
