import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { listsQueryOptions } from "@/features/lists/lib/lists-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/collections/lists/import/cardmarket")({
  head: () => privateSeoHead("Cards picked on Cardmarket"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...listsQueryOptions(context.userId, "organize"),
        staleTime: "static",
      }),
    ]);
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
});
