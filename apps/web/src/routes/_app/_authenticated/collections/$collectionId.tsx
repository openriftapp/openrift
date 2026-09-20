import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import {
  cleanedSearchForRedirect,
  collectionDetailSearchSchema,
} from "@/features/cards/lib/search-schemas";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

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
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Collection", noIndex: true }),
  loader: async ({ context, params }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    const collections = getCollectionsCollection(context.queryClient, context.userId);
    await collections.preload();
    if (!collections.has(params.collectionId)) {
      throw notFound();
    }
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
});
