import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { catalogQueryOptions, ensureCatalogComplete } from "@/features/cards/lib/catalog-queries";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { sessionQueryOptions } from "@/lib/auth-session";
import { requireFeature } from "@/lib/feature-flags";
import { privateSeoHead, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

interface ScanLoaderData {
  served: true;
}

export const Route = createFileRoute("/_app/scan")({
  // false: the camera stream and the collection live queries exist only in the browser.
  ssr: false,
  staticData: { hideFooter: true },
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "scanner"),
  loader: async ({ context }): Promise<ScanLoaderData> => {
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
      await loadCollection(getCollectionsCollection(context.queryClient, session.user.id));
    };
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      preloadCollections(),
    ]);
    // The catalog's client fetch covers the user's languages first; the scanner
    // must match printings of ANY language, so pull the remaining ones now
    // (no-op when complete) without blocking the route transition on them.
    void ensureCatalogComplete(context.queryClient);
    return { served: true };
  },
  head: ({ loaderData }) =>
    (loaderData as ScanLoaderData | undefined)?.served
      ? seoHead({
          siteUrl: getSiteUrl(),
          title: "Scan cards",
          description:
            "Scan Riftbound cards with your phone or webcam. Cards are recognised on your device, and you can add them to a collection once you sign in.",
          path: "/scan",
          noIndex: true,
        })
      : privateSeoHead("Scan cards"),
  pendingComponent: () => <CollectionPending width="capped" />,
  notFoundComponent: NotFoundFallback,
});
