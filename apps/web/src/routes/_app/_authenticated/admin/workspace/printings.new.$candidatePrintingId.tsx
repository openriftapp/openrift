import type { QueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { loadRecordReferenceData } from "@/features/admin/lib/card-detail-prefetch";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { adminSeoHead } from "@/lib/seo";

async function loadQueuedCard(queryClient: QueryClient, candidatePrintingId: string) {
  const queue = await queryClient.query({ ...workspaceQueueQueryOptions(), staleTime: "static" });
  const cardSlug = queue.items.find(
    (item) => item.owner === "printing" && item.ownerId === candidatePrintingId,
  )?.cardSlug;
  if (cardSlug) {
    await queryClient.query({ ...adminCardDetailQueryOptions(cardSlug), staleTime: "static" });
  }
}

export const Route = createFileRoute(
  "/_app/_authenticated/admin/workspace/printings/new/$candidatePrintingId",
)({
  loader: async ({ context, params, preload }) => {
    const { queryClient } = context;
    // The record shows its own loading and error states, so the queue and its card are not awaited.
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
