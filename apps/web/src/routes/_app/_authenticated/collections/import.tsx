import { createFileRoute } from "@tanstack/react-router";

import { CollectionPending } from "@/features/collections/components/collection-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/collections/import")({
  head: () => privateSeoHead("Import"),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await loadCollection(getCollectionsCollection(context.queryClient, context.userId));
  },
  pendingComponent: CollectionPending,
});
