import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import {
  cleanedSearchForRedirect,
  collectionDetailSearchSchema,
} from "@/features/cards/lib/search-schemas";
import { CollectionGridPagePending } from "@/features/collections/components/collection-layout-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { missingImagesQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/collections/$collectionId")({
  // The layout route validates the shared filter set; this route adds `wanted`
  // on top, because the group-box filter it drives exists on no other surface.
  validateSearch: collectionDetailSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    // Strip unknown / malformed search params — same canonicalization as
    // /cards.
    const cleaned = cleanedSearchForRedirect(
      collectionDetailSearchSchema,
      search,
      location.searchStr,
      { legacySearchToQ: true },
    );
    if (cleaned) {
      throw redirect({
        to: "/collections/$collectionId",
        params: { collectionId: params.collectionId },
        search: cleaned,
        replace: true,
      });
    }
  },
  head: () => privateSeoHead("Collection"),
  loader: async ({ context, params }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    const collections = getCollectionsCollection(context.queryClient, context.userId);
    await Promise.all([
      loadCollection(collections),
      // The missing-images callout is optional; its failure must not fail the page.
      context.queryClient
        .query({ ...missingImagesQueryOptions(context.userId), staleTime: "static" })
        .catch(() => null),
    ]);
    if (!collections.has(params.collectionId)) {
      throw notFound();
    }
  },
  pendingComponent: CollectionGridPagePending,
});
