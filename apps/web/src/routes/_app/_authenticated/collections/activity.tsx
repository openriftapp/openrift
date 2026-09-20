import { createFileRoute } from "@tanstack/react-router";

import { CollectionPending } from "@/features/collections/components/collection-pending";
import { collectionEventsQueryOptions } from "@/features/collections/lib/collection-events-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/collections/activity")({
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Collection Activity", noIndex: true }),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await Promise.all([
      context.queryClient.infiniteQuery({
        ...collectionEventsQueryOptions(context.userId),
        staleTime: "static",
      }),
      getCollectionsCollection(context.queryClient, context.userId).preload(),
    ]);
  },
  pendingComponent: CollectionPending,
});
