import { createFileRoute } from "@tanstack/react-router";

import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/collections/stats")({
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Collection Statistics", noIndex: true }),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await Promise.all([
      getCollectionsCollection(context.queryClient, context.userId).preload(),
      context.queryClient.query({ ...publicSetListQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: CollectionPending,
});
