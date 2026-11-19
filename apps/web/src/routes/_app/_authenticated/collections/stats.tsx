import { createFileRoute } from "@tanstack/react-router";

import { customTagsQueryOptions } from "@/features/cards/lib/custom-tags-queries";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { CollectionPagePending } from "@/features/collections/components/collection-layout-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { missingImagesQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
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
      // The missing-images callout is optional; its failure must not fail the page.
      context.queryClient
        .query({ ...missingImagesQueryOptions(context.userId), staleTime: "static" })
        .catch(() => null),
    ]);
  },
  pendingComponent: CollectionPagePending,
});
