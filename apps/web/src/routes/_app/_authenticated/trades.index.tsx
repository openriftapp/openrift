import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { userTradesQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/trades/")({
  ssr: "data-only",
  head: () => privateSeoHead("Trades"),
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...userTradesQueryOptions(context.userId),
      staleTime: "static",
    });
  },
  errorComponent: RouteErrorFallback,
});
