import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { reviewCardsQueryOptions } from "@/features/catalog-workspace/lib/review-cards";
import { cardsRouteSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/cards")({
  validateSearch: cardsRouteSearchSchema,
  loader: ({ context }) => {
    void Promise.allSettled([
      context.queryClient.query({ ...reviewCardsQueryOptions(), staleTime: "static" }),
    ]);
  },
  head: () => adminSeoHead("Cards"),
  pendingComponent: AdminPending,
});
