import type { QueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import {
  loadCardDetailData,
  loadDeskRecordReferenceData,
} from "@/features/admin/lib/card-detail-prefetch";
import { deskCardPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { adminSeoHead } from "@/lib/seo";

async function loadFaceRecord(
  queryClient: QueryClient,
  userId: string,
  cardSlug: string,
  preload: boolean,
): Promise<unknown> {
  const access = await queryClient.query({
    ...adminAccessQueryOptions(userId),
    staleTime: "static",
  });
  const canReview = hasAdminSection(access, "card-review");
  if (!preload) {
    void Promise.allSettled([
      canReview
        ? queryClient.query({ ...adminCardDetailQueryOptions(cardSlug), staleTime: "static" })
        : queryClient.query({ ...deskCardPrintingsQueryOptions(cardSlug), staleTime: "static" }),
    ]);
  }
  return canReview
    ? loadCardDetailData(queryClient, userId)
    : loadDeskRecordReferenceData(queryClient);
}

export const Route = createFileRoute(
  "/_app/_authenticated/admin/workspace/faces/$cardSlug/$faceId",
)({
  loader: async ({ context, params, preload }) => {
    await loadFaceRecord(context.queryClient, context.userId, params.cardSlug, preload);
  },
  head: () => adminSeoHead("Face"),
  pendingComponent: AdminPending,
});
