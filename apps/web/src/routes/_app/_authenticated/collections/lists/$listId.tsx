import { createFileRoute, notFound } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { CollectionPending } from "@/features/collections/components/collection-pending";
import { listDetailQueryOptions } from "@/features/lists/lib/lists-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/_authenticated/collections/lists/$listId")({
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "List", noIndex: true }),
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.query({
        ...listDetailQueryOptions(context.userId, params.listId),
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: CollectionPending,
  errorComponent: RouteErrorFallback,
});
