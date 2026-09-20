import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions, loadCatalogTail } from "@/features/cards/lib/catalog-query";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/scan")({
  // false: the camera stream and the collection live queries exist only in the browser.
  ssr: false,
  staticData: { hideFooter: true },
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Scan cards", noIndex: true }),
  loader: async ({ context }) => {
    const { getCollectionsCollection } =
      await import("@/features/collections/lib/collections-collection");
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      getCollectionsCollection(context.queryClient, context.userId).preload(),
    ]);
    // The catalog's client fetch covers the user's languages first; the scanner
    // must match printings of ANY language, so pull the remaining ones now
    // (no-op when complete) without blocking the route transition on them.
    void loadCatalogTail(context.queryClient);
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
});
