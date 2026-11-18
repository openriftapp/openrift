import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { userTradesQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { friendGroupsQueryOptions } from "@/features/groups/lib/friend-groups-queries";
import { lenient } from "@/lib/lenient-param";
import { privateSeoHead } from "@/lib/seo";

const tradesSearchSchema = z.object({
  group: lenient(z.string()),
});

export const Route = createFileRoute("/_app/_authenticated/trades/")({
  ssr: "data-only",
  validateSearch: tradesSearchSchema,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({
        ...userTradesQueryOptions(context.userId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...friendGroupsQueryOptions(context.userId),
        staleTime: "static",
      }),
    ]);
  },
  head: () => privateSeoHead("Trades"),
});
