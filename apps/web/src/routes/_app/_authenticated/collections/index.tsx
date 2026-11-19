import { createFileRoute, redirect } from "@tanstack/react-router";

import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { CollectionGridPagePending } from "@/features/collections/components/collection-layout-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { missingImagesQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/collections/")({
  beforeLoad: ({ search, location }) => {
    // Strip unknown / malformed search params — same canonicalization as
    // /cards. (The filter schema is validated by the collections layout route.)
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr, {
      legacySearchToQ: true,
    });
    if (cleaned) {
      throw redirect({ to: "/collections", search: cleaned, replace: true });
    }
  },
  head: () => privateSeoHead("Collections"),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await Promise.all([
      loadCollection(getCollectionsCollection(context.queryClient, context.userId)),
      // The missing-images callout is optional; its failure must not fail the page.
      context.queryClient
        .query({ ...missingImagesQueryOptions(context.userId), staleTime: "static" })
        .catch(() => null),
    ]);
  },
  pendingComponent: CollectionGridPagePending,
});
