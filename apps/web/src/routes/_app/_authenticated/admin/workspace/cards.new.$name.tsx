import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  allCardsQueryOptions,
  unmatchedCardDetailQueryOptions,
} from "@/features/admin/lib/admin-card-queries";
import { loadCardDetailData } from "@/features/admin/lib/card-detail-prefetch";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/cards/new/$name")({
  loader: async ({ context, params, preload }) => {
    // The record shows its own loading and error states, so its detail is not awaited.
    if (!preload) {
      void Promise.allSettled([
        context.queryClient.query({
          ...unmatchedCardDetailQueryOptions(params.name),
          staleTime: "static",
        }),
      ]);
    }
    await Promise.all([
      loadCardDetailData(context.queryClient),
      context.queryClient.query({ ...allCardsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    ]);
  },
  head: () => adminSeoHead("New Card"),
  pendingComponent: AdminPending,
});
