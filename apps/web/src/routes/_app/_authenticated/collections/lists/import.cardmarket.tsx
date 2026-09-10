import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions } from "@/features/cards/hooks/catalog-query";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { listsQueryOptions } from "@/features/lists/hooks/use-lists";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/collections/lists/import/cardmarket")({
  // data-only: the picks arrive in the URL fragment, which only the browser can read.
  ssr: "data-only",
  head: () =>
    seoHead({ siteUrl: getSiteUrl(), title: "Cards picked on Cardmarket", noIndex: true }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...listsQueryOptions(context.userId, "organize"),
        staleTime: "static",
      }),
    ]);
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
});
