import { createFileRoute } from "@tanstack/react-router";

import { CollectionPending } from "@/features/collections/components/collection-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/collections/import")({
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Import", noIndex: true }),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await loadCollection(getCollectionsCollection(context.queryClient, context.userId));
  },
  pendingComponent: CollectionPending,
});
