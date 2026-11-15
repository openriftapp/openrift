import { createFileRoute } from "@tanstack/react-router";

import { tradeSheetQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/trades/$userId")({
  ssr: "data-only",
  // `from` carries the group the viewer came through, so the trail leads
  // back there; checked against the sheet's own groups before use.
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" && search.from.length > 0 ? search.from : undefined,
  }),
  head: () => privateSeoHead("Trade sheet"),
  loader: async ({ context, params }) => {
    await context.queryClient.query({
      ...tradeSheetQueryOptions(context.userId, params.userId),
      staleTime: "static",
    });
  },
});
