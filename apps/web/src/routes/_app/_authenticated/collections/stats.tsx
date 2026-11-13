import { createFileRoute } from "@tanstack/react-router";

import { customTagsQueryOptions } from "@/features/cards/lib/custom-tags-queries";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/collections/stats")({
  head: () => privateSeoHead("Collection Statistics"),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await Promise.all([
      loadCollection(getCollectionsCollection(context.queryClient, context.userId)),
      context.queryClient.query({ ...publicSetListQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...customTagsQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: CollectionPending,
});
