import type { QueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { loadRecordReferenceData } from "@/features/admin/lib/card-detail-prefetch";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { candidatePrintingCardQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { adminSeoHead } from "@/lib/seo";

async function loadQueuedCard(queryClient: QueryClient, candidatePrintingId: string) {
  const { cardSlug } = await queryClient.query({
    ...candidatePrintingCardQueryOptions(candidatePrintingId),
    staleTime: "static",
  });
  if (cardSlug) {
    await queryClient.query({ ...adminCardDetailQueryOptions(cardSlug), staleTime: "static" });
  }
}

export const Route = createFileRoute(
  "/_app/_authenticated/admin/workspace/printings/new/$candidatePrintingId",
)({
  loader: async ({ context, params, preload }) => {
    const { queryClient } = context;
    // The record shows its own loading and error states, so the source row's card is not awaited.
    if (!preload) {
      void Promise.allSettled([loadQueuedCard(queryClient, params.candidatePrintingId)]);
    }
    await Promise.all([
      loadRecordReferenceData(queryClient),
      queryClient.query({ ...setsQueryOptions, staleTime: "static" }),
    ]);
  },
  head: () => adminSeoHead("New Printing"),
  pendingComponent: AdminPending,
});
