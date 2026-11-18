import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { loadCardDetailData } from "@/features/admin/lib/card-detail-prefetch";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/cards/$cardSlug")({
  loader: async ({ context, params, preload }) => {
    // The record shows its own loading and error states, so its detail is not awaited.
    if (!preload) {
      void Promise.allSettled([
        context.queryClient.query({
          ...adminCardDetailQueryOptions(params.cardSlug),
          staleTime: "static",
        }),
      ]);
    }
    await loadCardDetailData(context.queryClient, context.userId);
  },
  head: () => adminSeoHead("Card"),
  pendingComponent: AdminPending,
});
