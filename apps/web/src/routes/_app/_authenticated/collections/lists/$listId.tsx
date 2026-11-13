import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { listDetailQueryOptions } from "@/features/lists/lib/lists-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute("/_app/_authenticated/collections/lists/$listId")({
  head: () => privateSeoHead("List"),
  loader: async ({ context, params }) => {
    await notFoundOnSentinel(
      context.queryClient.query({
        ...listDetailQueryOptions(context.userId, params.listId),
        staleTime: "static",
      }),
    );
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
