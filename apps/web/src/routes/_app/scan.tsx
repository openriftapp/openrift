import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions, loadCatalogTail } from "@/features/cards/lib/catalog-queries";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { requireScanner } from "@/features/scan/lib/scanner-flag";
import { sessionQueryOptions } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/scan")({
  // false: the camera stream and the collection live queries exist only in the browser.
  ssr: false,
  staticData: { hideFooter: true },
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Scan cards",
      description:
        "Scan Riftbound cards with your phone or webcam. Cards are recognised on your device, and you can add them to a collection once you sign in.",
      path: "/scan",
      noIndex: true,
    }),
  beforeLoad: async ({ context }) => {
    await requireScanner(context.queryClient);
  },
  loader: async ({ context }) => {
    const preloadCollections = async () => {
      const session = await context.queryClient.query({
        ...sessionQueryOptions(),
        staleTime: "static",
      });
      if (!session?.user) {
        return;
      }
      const { getCollectionsCollection } =
        await import("@/features/collections/lib/collections-collection");
      await getCollectionsCollection(context.queryClient, session.user.id).preload();
    };
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      preloadCollections(),
    ]);
    // The catalog's client fetch covers the user's languages first; the scanner
    // must match printings of ANY language, so pull the remaining ones now
    // (no-op when complete) without blocking the route transition on them.
    void loadCatalogTail(context.queryClient);
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
});
